import { err } from "inngest/types"
import User from "../models/User.js"
import fs from 'fs'
import imagekit from "../configs/imageKit.js"
import { format } from "path"
import { clerkClient } from '@clerk/express';
import Connection from "../models/Connection.js"


// Get User Data using userId
export const getUserData = async (req, res) => {
    try{
        const { userId } = req.auth()
        const user = await User.findById(userId)
        if(!user){
            return res.json({success: false, message: "User not found"})
        }
        res.json({success: true, user})
    } catch(error){
        console.log(error);
        res.json({success: false, message: error.message})
    }
}


 // Update User Data
export const updateUserData = async (req, res) => {
    try {
        const { userId } = req.auth();

        // Parse the body sent through Postman form-data.
        let body = req.body;

        if (typeof req.body.body === "string") {
            try {
                body = JSON.parse(req.body.body);
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "Invalid JSON in the body field",
                });
            }
        }

        let { username, bio, location, full_name } = body;

        const tempUser = await User.findById(userId);

        if (!tempUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Keep the existing username if none was provided.
        username = username || tempUser.username;

        // Check whether another user already uses this username.
        if (username !== tempUser.username) {
            const existingUser = await User.findOne({
                username,
                _id: { $ne: userId },
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Username is already taken",
                });
            }
        }

        // Preserve existing fields when they are not provided.
        const updatedData = {
            username,
            bio: bio ?? tempUser.bio,
            location: location ?? tempUser.location,
            full_name: full_name ?? tempUser.full_name,
        };

        const profile = req.files?.profile?.[0];
        const cover = req.files?.cover?.[0];

        // Upload profile picture.
        if (profile) {
            const response = await imagekit.files.upload({
                file: fs.createReadStream(profile.path),
                fileName: profile.originalname,
            });

            updatedData.profile_picture =
                imagekit.helper.buildSrc({
                    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
                    src: response.filePath,
                    transformation: [
                        {
                            quality: 80,
                            format: "webp",
                            width: 512,
                        },
                    ],
                });
        }

        // Upload cover photo.
        if (cover) {
            const response = await imagekit.files.upload({
                file: fs.createReadStream(cover.path),
                fileName: cover.originalname,
            });

            updatedData.cover_photo =
                imagekit.helper.buildSrc({
                    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
                    src: response.filePath,
                    transformation: [
                        {
                            quality: 80,
                            format: "webp",
                            width: 1280,
                        },
                    ],
                });
        }

        // Save updated profile in MongoDB.
        const user = await User.findByIdAndUpdate(
            userId,
            updatedData,
            {
                new: true,
                runValidators: true,
            }
        );

        return res.status(200).json({
            success: true,
            user,
            message: "Profile updated successfully",
        });

    } catch (error) {
        console.error("Profile update failed:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// Find users using username, email, location, name
export const discoverUsers = async (req, res) => {
    try{
        const { userId } = req.auth()
        const { input } = req.body;

        const allUsers = await User.find(
            {
                $or: [
                    {username: new RegExp(input, 'i')},
                    {email: new RegExp(input, 'i')},
                    {full_name: new RegExp(input, 'i')},
                    {location: new RegExp(input, 'i')},
                ]
            }
        )

        const filteredUsers = allUsers.filter(user=> user._id !== userId)
        res.json({success: true, users: filteredUsers})
        
    } catch(error){
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Follow User
export const followUser = async (req, res) => {
    try{
        const { userId } = req.auth()
        const { id } = req.body;

        const user = await User.findById(userId)

        if(user.following.includes(id)){
            return res.json({ success: false, message: 'You are already following this user'})
        }

        user.following.push(id);
        await user.save()

        const toUser = await User.findById(id)
        toUser.followers.push(userId)
        await toUser.save()

        res.json({success: true, message: 'Now you are following this user'})
        
    } catch(error){
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Unfollow user
export const unfollowUser = async (req, res) => {
    try{
        const { userId } = req.auth()
        const { id } = req.body;

        const user = await User.findById(userId)
        user.following = user.following.filter(user=> user !== id);
        await user.save()

        const toUser = await User.findById(id)
        toUser.followers = toUser.followers.filter(user=> user !== userId);
        await toUser.save()

        res.json({success: true, message: 'You are no longer following this user'})
        
    } catch(error){
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Send Connection Request
export const sendConnectionRequest = async (req, res) => {
    try {
        const {userId} = req.auth()
        const { id } = req.body;

        // Check if user has sent more than 20 connection requests in the last 24 hours
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const connectionRequests = await Connection.find({from_user_id: userId, created_at: {$gt: last24Hours}})
        if(connectionRequests.length >= 20){
            return res.json({success: false, message: 'You have sent more than 20 connection requests in the last 24 hours'})
        }

        // Check if users are already conected
        const connection = await Connection.findOne({
            $or: [
                {rom_user_id: userId, to_user_id: id},
                {rom_user_id: id, to_user_id: userId},
            ]
        })

        if(!connection){
            await Connection.create({
                from_user_id: userId,
                to_user_id: id
            })
            return res.json({success: true, message: 'Connection request sent successfully'})
        } else if(connection && connection.status === 'accepted'){
            return res.json({success: false, message: 'You are already connected with this user'})
        }

        return res.json({success: false, message: 'Connection request pending'})

    } catch(error){
        console.log(error)
        res.json({success: false, message: error.message})
        
    }
}

// Get User Connections
export const getUserConnections = async (req, res) => {
    try {
        const {userId} = req.auth()
        const user = await User.findById(userId).populate('connections followers following')

        const connections = user.connections
        const followers = user.followers
        const following = user.following

        const pendingConnections = (await Connection.find({to_user_id: userId, status: 'pending'}).populate('from_user_id')).map(connection=>connection.from_user_id)

        res.json({success: true, connections, followers, following, pendingConnections})

    } catch(error){
        console.log(error)
        res.json({success: false, message: error.message})
        
    }
}

// Accept Connection Request
export const acceptConnectionRequest = async (req, res) => {
    try {
        const {userId} = req.auth()
        const { id } = req.body;

        const connection = await Connection.findOne({from_user_id: id, to_user_id: userId})

        if(!connection){
            return res.json({success: false, message: 'Connection not found'});
        }

        const user = await User.findById(userId);
        user.connections.push(id);
        await user.save()

        const toUser = await User.findById(id);
        toUser.connections.push(userId);
        await toUser.save()

        connection.status = 'accepted';
        await connection.save()

        res.json({success: true, message: 'Connection accepted successfully'});
        

    } catch(error){
        console.log(error)
        res.json({success: false, message: error.message})
        
    }
}