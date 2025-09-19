import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const videoFile = formData.get('video') as File
    const resolution = formData.get('resolution') as string
    const mirrored = formData.get('mirrored') === 'true'

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    // Tạo thư mục temp nếu chưa có
    const tempDir = join(process.cwd(), 'temp')
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    // Tạo tên file unique
    const timestamp = Date.now()
    const inputFileName = `input_${timestamp}.${videoFile.name.split('.').pop()}`
    const outputFileName = `output_${timestamp}.mp4`
    
    const inputPath = join(tempDir, inputFileName)
    const outputPath = join(tempDir, outputFileName)

    // Lưu file input
    const arrayBuffer = await videoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(inputPath, buffer)

    // Xây dựng lệnh FFmpeg
    const resolutions = {
      '720p': '1280x720',
      '1080p': '1920x1080',
      '4K': '3840x2160'
    }

    let ffmpegCommand = `ffmpeg -i "${inputPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -s ${resolutions[resolution as keyof typeof resolutions] || resolutions['1080p']}`

    if (mirrored) {
      ffmpegCommand += ' -vf "hflip"'
    }

    ffmpegCommand += ` "${outputPath}"`

    console.log('Executing FFmpeg command:', ffmpegCommand)

    // Chạy FFmpeg
    await execAsync(ffmpegCommand)

    // Đọc file output
    const outputBuffer = await import('fs').then(fs => fs.promises.readFile(outputPath))

    // Cleanup temp files
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})

    // Trả về video đã xử lý
    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="processed_${videoFile.name}"`,
      },
    })

  } catch (error) {
    console.error('Error processing video:', error)
    return NextResponse.json(
      { error: 'Failed to process video', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
