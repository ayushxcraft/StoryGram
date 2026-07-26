import { Inngest } from "inngest";
import User from "../models/User.js";

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
      email_addresses,
      image_url,
    } = event.data;

    let username = email_addresses[0].email_address.split("@")[0];

    // Check if username already exists
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      username += Math.floor(Math.random() * 10000);
    }

    await User.create({
      _id: id,
      email: email_addresses[0].email_address,
      full_name: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
      profile_picture: image_url,
      username,
    });
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
      email_addresses,
      image_url,
    } = event.data;

    await User.findByIdAndUpdate(id, {
      email: email_addresses[0].email_address,
      full_name: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
      profile_picture: image_url,
    });
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

// Export all functions
export const functions = [
  syncUserCreation,
  syncUserUpdation,
  syncUserDeletion,
];