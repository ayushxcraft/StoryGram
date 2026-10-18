
import React, { useEffect, useRef, useState } from 'react'
import { ImageIcon, SendHorizonal } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import api from '../api/axios'
import {
    addMessages,
    fetchMessages,
    resetMessages
} from '../features/messages/messagesSlice'
import toast from 'react-hot-toast'

const ChatBox = () => {
    const { messages } = useSelector((state) => state.messages)
    const connections = useSelector((state) => state.connections.connections)
    const currentUser = useSelector((state) => state.user.value)

    const currentUserId = currentUser?._id
    const { userId } = useParams()
    const { getToken } = useAuth()
    const dispatch = useDispatch()

    const [text, setText] = useState('')
    const [image, setImage] = useState(null)
    const [user, setUser] = useState(null)

    const messagesEndRef = useRef(null)

    // Fetch previous messages
    const fetchUserMessages = async () => {
        try {
            const token = await getToken()
            await dispatch(fetchMessages({ token, userId })).unwrap()
        } catch (error) {
            toast.error(error.message || 'Unable to load messages')
        }
    }

    // Send a text or image message
    const sendMessage = async () => {
        try {
            if (!text.trim() && !image) return

            const token = await getToken()
            const formData = new FormData()

            formData.append('to_user_id', userId)
            formData.append('text', text)

            if (image) {
                formData.append('image', image)
            }

            const { data } = await api.post(
                '/api/message/send',
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            if (!data.success) {
                throw new Error(data.message || 'Message could not be sent')
            }

            // Add the sent message to the sender's chat immediately
            dispatch(addMessages(data.message))
            setText('')
            setImage(null)
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                error.message ||
                'Failed to send message'
            )
        }
    }

    // Load conversation when the selected user changes
    useEffect(() => {
        dispatch(resetMessages())

        if (userId) {
            fetchUserMessages()
        }

        return () => {
            dispatch(resetMessages())
        }
    }, [userId])

    // Identify the selected conversation user
    useEffect(() => {
        const selectedUser = connections?.find(
            (connection) => connection._id === userId
        )

        setUser(selectedUser || null)
    }, [connections, userId])

    // Subscribe to real-time messages through SSE
    useEffect(() => {
        if (!currentUserId) return

        const baseURL = (api.defaults.baseURL || '').replace(/\/+$/, '')

        if (!baseURL) {
            console.error('API base URL is not configured')
            return
        }

        const eventSource = new EventSource(
            `${baseURL}/api/message/${encodeURIComponent(currentUserId)}`
        )

        eventSource.onmessage = (event) => {
            try {
                const incomingMessage = JSON.parse(event.data)

                // The backend populates from_user_id for SSE messages.
                const senderId =
                    typeof incomingMessage.from_user_id === 'string'
                        ? incomingMessage.from_user_id
                        : incomingMessage.from_user_id?._id

                const receiverId =
                    typeof incomingMessage.to_user_id === 'string'
                        ? incomingMessage.to_user_id
                        : incomingMessage.to_user_id?._id

                // Add only messages belonging to the open conversation.
                const belongsToCurrentChat =
                    (senderId === userId && receiverId === currentUserId) ||
                    (senderId === currentUserId && receiverId === userId)

                if (belongsToCurrentChat) {
                    dispatch(addMessages(incomingMessage))
                }
            } catch (error) {
                console.error('Unable to process incoming message:', error)
            }
        }

        eventSource.onerror = (error) => {
            console.error('Real-time message connection error:', error)
        }

        return () => {
            eventSource.close()
        }
    }, [currentUserId, userId, dispatch])

    // Scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth'
        })
    }, [messages])

    if (!user) return null

    return (
        <div className="flex flex-col h-screen">
            {/* Chat Header */}
            <div className="flex items-center gap-2 p-2 md:px-10 xl:pl-42 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-300">
                <img
                    src={user.profile_picture}
                    alt=""
                    className="size-8 rounded-full object-cover"
                />

                <div>
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-sm text-gray-500 -mt-1.5">
                        @{user.username}
                    </p>
                </div>
            </div>

            {/* Messages */}
            <div className="p-5 md:px-10 h-full overflow-y-scroll">
                <div className="space-y-4 max-w-4xl mx-auto">
                    {messages
                        .toSorted(
                            (a, b) =>
                                new Date(a.createdAt) - new Date(b.createdAt)
                        )
                        .map((message, index) => (
                            <div
                                key={message._id || index}
                                className={`flex flex-col ${
                                    message.to_user_id !== user._id
                                        ? 'items-start'
                                        : 'items-end'
                                }`}
                            >
                                <div
                                    className={`p-2 text-sm max-w-sm bg-white text-slate-700 rounded-lg shadow ${
                                        message.to_user_id !== user._id
                                            ? 'rounded-bl-none'
                                            : 'rounded-br-none'
                                    }`}
                                >
                                    {message.message_type === 'image' && (
                                        <img
                                            src={message.media_url}
                                            alt="Message attachment"
                                            className="w-full max-w-sm rounded-lg mb-1"
                                        />
                                    )}

                                    {message.text && <p>{message.text}</p>}
                                </div>
                            </div>
                        ))}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Message Input */}
            <div className="px-4">
                <div className="flex items-center gap-3 pl-5 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow rounded-full mb-5">
                    <input
                        type="text"
                        className="flex-1 outline-none text-slate-700"
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                sendMessage()
                            }
                        }}
                        onChange={(e) => setText(e.target.value)}
                        value={text}
                    />

                    <label htmlFor="image" className="cursor-pointer">
                        {image ? (
                            <img
                                src={URL.createObjectURL(image)}
                                alt="Selected attachment"
                                className="h-8 rounded"
                            />
                        ) : (
                            <ImageIcon className="size-7 text-gray-400 cursor-pointer" />
                        )}

                        <input
                            type="file"
                            id="image"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                setImage(e.target.files?.[0] || null)
                            }}
                        />
                    </label>

                    <button
                        onClick={sendMessage}
                        className="bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 cursor-pointer text-white p-2 rounded-full"
                    >
                        <SendHorizonal size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ChatBox
