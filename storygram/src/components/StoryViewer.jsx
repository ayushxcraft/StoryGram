
import { BadgeCheck, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

const StoryViewer = ({ viewStory, setViewStory }) => {
    const [progress, setProgress] = useState(0)

    const videoRef = useRef(null)
    const animationFrameRef = useRef(null)

    // Progress timer for text and image stories
    useEffect(() => {
        let timer
        let progressInterval

        if (!viewStory) {
            setProgress(0)
            return
        }

        setProgress(0)

        if (viewStory.media_type !== 'video') {
            const duration = 10000
            const interval = 100
            let elapsed = 0

            progressInterval = setInterval(() => {
                elapsed += interval
                setProgress(Math.min((elapsed / duration) * 100, 100))
            }, interval)

            timer = setTimeout(() => {
                setViewStory(null)
            }, duration)
        }

        return () => {
            clearTimeout(timer)
            clearInterval(progressInterval)
            cancelAnimationFrame(animationFrameRef.current)
        }
    }, [viewStory, setViewStory])

    // Update video progress smoothly
    const updateVideoProgress = () => {
        const video = videoRef.current

        if (!video) return

        if (Number.isFinite(video.duration) && video.duration > 0) {
            setProgress(
                Math.min((video.currentTime / video.duration) * 100, 100)
            )
        }

        if (!video.paused && !video.ended) {
            animationFrameRef.current =
                requestAnimationFrame(updateVideoProgress)
        }
    }

    const handleVideoPlay = () => {
        cancelAnimationFrame(animationFrameRef.current)

        animationFrameRef.current =
            requestAnimationFrame(updateVideoProgress)
    }

    const handleVideoPause = () => {
        cancelAnimationFrame(animationFrameRef.current)
    }

    // Pause while pressing and resume when releasing
    const handleVideoPress = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.pause()
    }

    const handleVideoRelease = (e) => {
        const video = e.currentTarget

        if (!video.ended) {
            video.play().catch(() => {})
        }
    }

    const handleClose = () => {
        setViewStory(null)
    }

    if (!viewStory) return null

    const renderContent = () => {
        switch (viewStory.media_type) {
            case 'image':
                return (
                    <img
                        src={viewStory.media_url}
                        alt=""
                        className="max-w-full max-h-[90vh] object-contain"
                    />
                )

            case 'video':
                return (
                    <video
                        ref={videoRef}
                        src={viewStory.media_url}
                        className="max-h-[90vh] max-w-full object-contain select-none"
                        autoPlay
                        playsInline
                        onPlay={handleVideoPlay}
                        onPause={handleVideoPause}
                        onEnded={() => setViewStory(null)}
                        onPointerDown={handleVideoPress}
                        onPointerUp={handleVideoRelease}
                        onPointerCancel={handleVideoRelease}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                )

            case 'text':
                return (
                    <div className="w-full h-full flex items-center justify-center p-8 text-white text-2xl text-center">
                        {viewStory.content}
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div
            className="fixed inset-0 h-screen z-[110] flex items-center justify-center"
            style={{
                backgroundColor:
                    viewStory.media_type === 'text'
                        ? viewStory.background_color
                        : '#000000'
            }}
        >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-700">
                <div
                    className={`h-full bg-white ${
                        viewStory.media_type === 'video'
                            ? ''
                            : 'transition-all duration-100 ease-linear'
                    }`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* User Info */}
            <div className="absolute top-4 left-4 flex items-center space-x-3 p-2 px-4 sm:p-4 sm:px-8 backdrop-blur-2xl rounded bg-black/50">
                <img
                    src={viewStory.user?.profile_picture}
                    alt=""
                    className="size-7 sm:size-8 rounded-full object-cover border border-white"
                />

                <div className="text-white font-medium flex items-center gap-1.5">
                    <span>{viewStory.user?.full_name}</span>
                    <BadgeCheck size={18} />
                </div>
            </div>

            {/* Close Button */}
            <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-white text-3xl font-bold"
            >
                <X className="w-8 h-8 hover:scale-110 transition cursor-pointer" />
            </button>

            {/* Story Content */}
            <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
                {renderContent()}
            </div>
        </div>
    )
}

export default StoryViewer
