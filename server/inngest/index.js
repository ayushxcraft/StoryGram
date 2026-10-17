import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import sendEmail from "../configs/nodeMailer.js";

// Create Inngest client
const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: [{ event: "clerk/user.created" }],
  },
  async ({ event }) => {
    const {
      id,
      first_name,
      last_name,
      email_addresses,
      image_url,
    } = event.data;

    const email = email_addresses?.[0]?.email_address;

    if (!id || !email) {
      throw new Error("Clerk user ID or email address is missing.");
    }

    let username = email.split("@")[0];

    // Check if username already exists
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      username += Math.floor(Math.random() * 10000);
    }

    // Use username if Clerk doesn't provide a full name
    const full_name =
      `${first_name ?? ""} ${last_name ?? ""}`.trim() || username;

    await User.create({
      _id: id,
      email: email,
      full_name: full_name,
      username: username,
      profile_picture: image_url || "",
    });

    console.log(`User created successfully: ${id}`);
  }
);


// =========================
// Sync User Update
// =========================

const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-from-clerk",
    triggers: [{ event: "clerk/user.updated" }],
  },
  async ({ event }) => {
    const {
      id,
      first_name,
      last_name,
      email_addresses = [],
      primary_email_address_id,
      image_url,
    } = event.data;

    const email =
      email_addresses.find(
        (item) => item.id === primary_email_address_id
      )?.email_address ||
      email_addresses[0]?.email_address;

    const nameFromParts = [first_name, last_name]
      .filter(
        (part) => typeof part === "string" && part.trim()
      )
      .join(" ")
      .trim();

    const updatedData = {};

    if (email) {
      updatedData.email = email;
    }

    // Don't replace an existing name with an empty string.
    if (nameFromParts) {
      updatedData.full_name = nameFromParts;
    }

    if (image_url !== undefined) {
      updatedData.profile_picture = image_url || "";
    }

    await User.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true,
    });

    console.log(
      `StoryGram user update processed: ${id}`
    );
  }
);


// =========================
// Sync User Delete
// =========================
const syncUserDeletion = inngest.createFunction(
  {
    id: "delete-user-with-clerk",
    triggers: [{ event: "clerk/user.deleted" }],
  },
  async ({ event }) => {
    const { id } = event.data;

    await User.findByIdAndDelete(id);
  }
);


// Inngest function to send Remainder when a new connection request is added
const sendNewConnectionRequestRemainder = inngest.createFunction(
  {
    id: "send-new-connection-request-remainder",
    triggers: [{ event: "app/connection-request" }],
  },
  async ({ event, step }) => {
    const {connectionId} = event.data;

    await step.run('send-connection-request-mail', async () => {
      const connection = await Connection.findById(connectionId).populate('from_user_id to_user_id');

      const subject = `👋 New Connection Request`;
      const body = `<div style="font-family: Arial, sans-serif; padding: 20px;"> 
      <h2>Hi ${connection.to_user_id.full_name},</h2> 
      <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p> 
      <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color: #10b981;">here</a> to accept or reject the request</p><br/> 
      <p>Thanks,<br/>StoryGram - Stay Connected</p>
      </div>`;

      await sendEmail({
        to: connection.to_user_id.email,
        subject,
        body
      })
    })

    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await step.sleepUntil("wait-for-24-hours", in24Hours);
    await step.run('send-connection-request-remainder', async() => {
      const connection = await Connection.findById(connectionId).populate('from_user_id to_user_id');

      if(connection.status === "accepted"){
        return {message: "Already accepted"}
      }

      const subject = `👋 New Connection Request`;
      const body = `<div style="font-family: Arial, sans-serif; padding: 20px;"> 
      <h2>Hi ${connection.to_user_id.full_name},</h2> 
      <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p> 
      <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color: #10b981;">here</a> to accept or reject the request</p><br/> 
      <p>Thanks,<br/>StoryGram - Stay Connected</p>
      </div>`;

      await sendEmail({
        to: connection.to_user_id.email,
        subject,
        body
      })

      return {message: "Remainder sent."}

    })
  }
)


// Export all functions
export const functions = [
  syncUserCreation,
  syncUserUpdation,
  syncUserDeletion,
  sendNewConnectionRequestRemainder
];