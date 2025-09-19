"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Upload, Play, Pause, Download, Settings, FlipHorizontal, X, Sparkles, Video, Zap } from "lucide-react"

interface VideoSettings {
  resolution: "720p" | "1080p" | "4K"
  mirrored: boolean
}

interface VideoFile {
  file: File
  url: string
  processedUrl?: string
  isProcessing?: boolean
  progress?: number
}

export default function VideoEditor() {
  const [videoFiles, setVideoFiles] = useState<VideoFile[]>([])
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [settings, setSettings] = useState<VideoSettings>({
    resolution: "1080p",
    mirrored: false,
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newVideoFiles: VideoFile[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.type.startsWith("video/")) {
          newVideoFiles.push({
            file,
            url: URL.createObjectURL(file),
          })
        }
      }
      setVideoFiles((prev) => [...prev, ...newVideoFiles])
    }
  }, [])

  const removeVideo = useCallback(
    (index: number) => {
      setVideoFiles((prev) => {
        const newFiles = prev.filter((_, i) => i !== index)
        if (currentVideoIndex >= newFiles.length && newFiles.length > 0) {
          setCurrentVideoIndex(newFiles.length - 1)
        } else if (newFiles.length === 0) {
          setCurrentVideoIndex(0)
        }
        return newFiles
      })
    },
    [currentVideoIndex],
  )

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying])

  const processVideo = useCallback(
    async (videoIndex: number) => {
      if (!videoRef.current || !canvasRef.current || !videoFiles[videoIndex]) return

      setVideoFiles((prev) =>
        prev.map((video, i) => (i === videoIndex ? { ...video, isProcessing: true, progress: 0 } : video)),
      )

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")

      if (!ctx) return

      const resolutions = {
        "720p": { width: 1280, height: 720 },
        "1080p": { width: 1920, height: 1080 },
        "4K": { width: 3840, height: 2160 },
      }

      const { width, height } = resolutions[settings.resolution]
      canvas.width = width
      canvas.height = height

      const progressInterval = setInterval(() => {
        setVideoFiles((prev) =>
          prev.map((video, i) =>
            i === videoIndex
              ? {
                  ...video,
                  progress: Math.min((video.progress || 0) + 10, 100),
                }
              : video,
          ),
        )
      }, 200)

      video.currentTime = 0
      await new Promise((resolve) => {
        video.addEventListener("loadeddata", resolve, { once: true })
      })

      if (settings.mirrored) {
        ctx.scale(-1, 1)
        ctx.drawImage(video, -width, 0, width, height)
        ctx.scale(-1, 1)
      } else {
        ctx.drawImage(video, 0, 0, width, height)
      }

      canvas.toBlob((blob) => {
        clearInterval(progressInterval)
        if (blob) {
          const processedUrl = URL.createObjectURL(blob)
          setVideoFiles((prev) =>
            prev.map((video, i) =>
              i === videoIndex
                ? {
                    ...video,
                    processedUrl,
                    isProcessing: false,
                    progress: 100,
                  }
                : video,
            ),
          )
        }
      }, "video/webm")
    },
    [settings, videoFiles],
  )

  const processAllVideos = useCallback(async () => {
    for (let i = 0; i < videoFiles.length; i++) {
      if (!videoFiles[i].processedUrl) {
        setCurrentVideoIndex(i)
        await new Promise((resolve) => setTimeout(resolve, 100))
        await processVideo(i)
      }
    }
  }, [videoFiles, processVideo])

  const downloadVideo = useCallback(
    (videoIndex: number) => {
      const video = videoFiles[videoIndex]
      if (video?.processedUrl) {
        const a = document.createElement("a")
        a.href = video.processedUrl
        a.download = `video_edited_${settings.resolution}_${Date.now()}.webm`
        a.setAttribute("download", a.download)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    },
    [videoFiles, settings.resolution],
  )

  const currentVideo = videoFiles[currentVideoIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-emerald-600 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative container mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-white/20 rounded-full backdrop-blur-sm">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">AI-Powered Video Editor</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent">
            Video Editor Pro
          </h1>
          <p className="text-xl text-cyan-100 max-w-2xl mx-auto leading-relaxed">
            Chỉnh sửa nhiều video cùng lúc với độ phân giải cao và hiệu ứng chuyên nghiệp
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl -mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 glass-card hover-lift border-0 shadow-2xl">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg text-white">
                  <Upload className="w-6 h-6" />
                </div>
                Upload Videos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {videoFiles.length === 0 ? (
                <div
                  className="relative border-2 border-dashed border-cyan-300 rounded-2xl p-16 text-center cursor-pointer hover:border-cyan-400 transition-all duration-300 bg-gradient-to-br from-cyan-50/50 to-blue-50/50 hover:from-cyan-100/50 hover:to-blue-100/50 group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300">
                      <Upload className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-800">Kéo thả video vào đây</h3>
                    <p className="text-gray-600 text-lg">hoặc click để chọn nhiều file cùng lúc</p>
                    <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Video className="w-4 h-4" />
                        MP4, MOV, AVI
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        Tối đa 100MB
                      </span>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                    {videoFiles.map((video, index) => (
                      <div
                        key={index}
                        className={`relative group cursor-pointer transition-all duration-300 hover-lift ${
                          currentVideoIndex === index
                            ? "ring-2 ring-cyan-500 ring-offset-2 ring-offset-white"
                            : "hover:ring-2 hover:ring-cyan-300 hover:ring-offset-2 hover:ring-offset-white"
                        }`}
                        onClick={() => setCurrentVideoIndex(index)}
                      >
                        <div className="gradient-border">
                          <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden">
                            <video src={video.url} className="w-full h-full object-cover" muted />
                            {currentVideoIndex === index && (
                              <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 to-transparent"></div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 px-2">
                          <p className="text-xs font-medium truncate text-gray-700">{video.file.name}</p>
                        </div>

                        {video.isProcessing && (
                          <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <div className="text-center text-white">
                              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                              <div className="text-sm font-medium">{video.progress}%</div>
                            </div>
                          </div>
                        )}

                        {video.processedUrl && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 left-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeVideo(index)
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {currentVideo && (
                    <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                      <video
                        ref={videoRef}
                        src={currentVideo.url}
                        className="w-full h-auto max-h-96 object-contain"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                      />
                      <div className="absolute bottom-4 left-4 flex gap-3">
                        <Button
                          size="sm"
                          onClick={togglePlayPause}
                          className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift"
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-white text-sm font-medium">
                        {currentVideoIndex + 1} / {videoFiles.length}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="bg-white/80 hover:bg-white border-cyan-200 hover:border-cyan-300 text-cyan-700 hover:text-cyan-800 hover-lift"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Thêm video
                    </Button>
                    <Button
                      onClick={() => processVideo(currentVideoIndex)}
                      disabled={currentVideo?.isProcessing}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg hover-lift disabled:opacity-50"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {currentVideo?.isProcessing ? "Đang xử lý..." : "Xử lý video này"}
                    </Button>
                    <Button
                      onClick={processAllVideos}
                      className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg hover-lift"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Xử lý tất cả
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card hover-lift border-0 shadow-2xl">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg text-white">
                  <Settings className="w-5 h-5" />
                </div>
                Cài đặt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Độ phân giải
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["720p", "1080p", "4K"] as const).map((res) => (
                    <Button
                      key={res}
                      variant={settings.resolution === res ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSettings((prev) => ({ ...prev, resolution: res }))}
                      className={
                        settings.resolution === res
                          ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg hover-lift"
                          : "bg-white/80 hover:bg-white border-gray-200 hover:border-cyan-300 text-gray-700 hover:text-cyan-700 hover-lift"
                      }
                    >
                      {res}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Hiệu ứng
                </Label>
                <Button
                  variant={settings.mirrored ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSettings((prev) => ({ ...prev, mirrored: !prev.mirrored }))}
                  className={`w-full flex items-center justify-center gap-2 transition-all duration-300 ${
                    settings.mirrored
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg pulse-glow"
                      : "bg-white/80 hover:bg-white border-gray-200 hover:border-emerald-300 text-gray-700 hover:text-emerald-700"
                  } hover-lift`}
                >
                  <FlipHorizontal className="w-4 h-4" />
                  {settings.mirrored ? "Đã lật ngược" : "Lật ngược video"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {videoFiles.some((video) => video.processedUrl) && (
            <Card className="lg:col-span-3 glass-card hover-lift border-0 shadow-2xl">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
                    <Download className="w-5 h-5" />
                  </div>
                  Video đã xử lý ({videoFiles.filter((v) => v.processedUrl).length}/{videoFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {videoFiles.map(
                    (video, index) =>
                      video.processedUrl && (
                        <div key={index} className="space-y-4 group">
                          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden shadow-lg hover-lift">
                            <video
                              src={video.processedUrl}
                              className="w-full h-auto max-h-48 object-contain"
                              controls
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium truncate text-gray-700">{video.file.name}</p>
                            <Button
                              onClick={() => downloadVideo(index)}
                              size="sm"
                              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover-lift"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Lưu vào bộ sưu tập
                            </Button>
                          </div>
                        </div>
                      ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
