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
    const outroVideoFile = formData.get('outroVideo') as File
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

    // Lưu file input chính
    const arrayBuffer = await videoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(inputPath, buffer)

    // Xây dựng lệnh FFmpeg
    const resolutions = {
      '720p': '720x1280',
      '1080p': '1080x1920',
      '4K': '2160x3840'
    }

    let ffmpegCommand = `ffmpeg -i "${inputPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -s ${resolutions[resolution as keyof typeof resolutions] || resolutions['1080p']}`

    if (mirrored) {
      ffmpegCommand += ' -vf "hflip"'
    }

    // Thêm outro video nếu có
    if (outroVideoFile) {
      const outroFileName = `outro_${timestamp}.${outroVideoFile.name.split('.').pop()}`
      const outroPath = join(tempDir, outroFileName)
      
      const outroArrayBuffer = await outroVideoFile.arrayBuffer()
      const outroBuffer = Buffer.from(outroArrayBuffer)
      await writeFile(outroPath, outroBuffer)
      
      // Tạo file tạm cho video chính đã xử lý
      const tempProcessedPath = join(tempDir, `temp_processed_${timestamp}.mp4`)
      
      // Xử lý video chính trước
      const processMainCommand = ffmpegCommand + ` "${tempProcessedPath}"`
      console.log('Processing main video:', processMainCommand)
      await execAsync(processMainCommand)
      
      // Re-encode outro video về cùng format và frame rate với video chính
      const outroProcessedPath = join(tempDir, `outro_processed_${timestamp}.mp4`)
      const outroProcessCommand = `ffmpeg -i "${outroPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -r 30 "${outroProcessedPath}"`
      console.log('Processing outro video:', outroProcessCommand)
      await execAsync(outroProcessCommand)
      
      // Tạo file list để concat
      const fileListPath = join(tempDir, `filelist_${timestamp}.txt`)
      const fileListContent = `file '${tempProcessedPath}'\nfile '${outroProcessedPath}'`
      await writeFile(fileListPath, fileListContent)
      
      // Sử dụng concat demuxer với copy (vì đã cùng format)
      ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy`
      
      // Cleanup temp files sau khi xử lý xong
      setTimeout(() => {
        unlink(tempProcessedPath).catch(() => {})
        unlink(outroProcessedPath).catch(() => {})
        unlink(fileListPath).catch(() => {})
      }, 1000)
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
    
    // Cleanup outro file nếu có
    if (outroVideoFile) {
      const outroFileName = `outro_${timestamp}.${outroVideoFile.name.split('.').pop()}`
      const outroPath = join(tempDir, outroFileName)
      await unlink(outroPath).catch(() => {})
    }

    // Trả về video đã xử lý
    return new Response(new Uint8Array(outputBuffer), {
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
