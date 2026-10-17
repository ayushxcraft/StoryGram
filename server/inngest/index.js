import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import sendEmail from "../configs/nodeMailer.js";

// Create Inngest client
export const inngest = new Inngest({
  id: "storygram-app",
});

// =========================
// Sync User Creation
// =========================

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
      username: clerkUsername,
      email_addresses = [],
      primary_email_address_id,
      image_url,
    } = event.data;

    // Find the primary email address.
    const email =
      email_addresses.find(
        (item) => item.id === primary_email_address_id
      )?.email_address ||
      email_addresses[0]?.email_address;

    if (!id || !email) {
      throw new Error(
        "Clerk user ID or email address is missing."
      );
    }

    // Ensure full_name is never empty.
    const nameFromParts = [first_name, last_name]
      .filter(
        (part) => typeof part === "string" && part.trim()
      )
      .join(" ")
      .trim();

    const full_name =
      nameFromParts ||
      (typeof clerkUsername === "string"
        ? clerkUsername.trim()
        : "") ||
      email.split("@")[0] ||
      "StoryGram User";

    // Generate a username.
    const baseUsername =
      (typeof clerkUsername === "string"
        ? clerkUsername.trim()
        : "") ||
      email.split("@")[0] ||
      `user_${id.slice(-6)}`;

    let username = baseUsername;
    let suffix = 1;

    // Ensure username is unique.
    while (
      await User.exists({
        username,
        _id: { $ne: id },
      })
    ) {
      username = `${baseUsername}${suffix}`;
      suffix++;
    }

    // Create or update the user, safely handling event replays.
    await User.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          email,
          full_name,
          username,
          profile_picture: image_url || "",
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(
      `StoryGram user synchronized successfully: ${id}`
    );
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