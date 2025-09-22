import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

// Khởi tạo Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Upload input video to Supabase
    const timestamp = Date.now()
    const inputFileName = `input_${timestamp}.${videoFile.name.split('.').pop()}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(`temp/${inputFileName}`, videoFile)

    if (uploadError) {
      throw new Error(`Error uploading video: ${uploadError.message}`)
    }

    // Tạo thư mục temp nếu chưa có
    const tempDir = join(process.cwd(), 'temp')
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    // Download file from Supabase to temp
    const { data: downloadData } = await supabase.storage
      .from('videos')
      .download(`temp/${inputFileName}`)

    if (!downloadData) {
      throw new Error('Failed to download uploaded file')
    }

    // Lưu file vào temp directory
    const inputPath = join(tempDir, inputFileName)
    const outputFileName = `output_${timestamp}.mp4`
    const outputPath = join(tempDir, outputFileName)
    await writeFile(inputPath, Buffer.from(await downloadData.arrayBuffer()))

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

    // Xử lý outro video nếu có
    if (outroVideoFile) {
      const outroFileName = `outro_${timestamp}.${outroVideoFile.name.split('.').pop()}`
      const outroPath = join(tempDir, outroFileName)
      
      // Upload outro to Supabase
      await supabase.storage
        .from('videos')
        .upload(`temp/${outroFileName}`, outroVideoFile)

      // Download outro to temp
      const { data: outroDownloadData } = await supabase.storage
        .from('videos')
        .download(`temp/${outroFileName}`)

      if (outroDownloadData) {
        await writeFile(outroPath, Buffer.from(await outroDownloadData.arrayBuffer()))
      }

      // Sử dụng filter_complex để ghép trực tiếp với re-encode
      const targetResolution = resolutions[resolution as keyof typeof resolutions] || resolutions['1080p']
      
      if (mirrored) {
        ffmpegCommand = `ffmpeg -i "${inputPath}" -i "${outroPath}" -filter_complex "[0:v]hflip,scale=${targetResolution}[v0];[1:v]scale=${targetResolution}[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" -map "[outv]" -map "[outa]" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k`
      } else {
        ffmpegCommand = `ffmpeg -i "${inputPath}" -i "${outroPath}" -filter_complex "[0:v]scale=${targetResolution}[v0];[1:v]scale=${targetResolution}[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" -map "[outv]" -map "[outa]" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k`
      }
    }

    ffmpegCommand += ` "${outputPath}"`

    // Chạy FFmpeg
    await execAsync(ffmpegCommand)

    // Upload output video to Supabase
    const outputBuffer = await import('fs').then(fs => fs.promises.readFile(outputPath))
    const { data: outputUploadData, error: outputUploadError } = await supabase.storage
      .from('videos')
      .upload(`processed/${outputFileName}`, outputBuffer)

    if (outputUploadError) {
      throw new Error(`Error uploading processed video: ${outputUploadError.message}`)
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(`processed/${outputFileName}`)

    // Cleanup temp files
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
    if (outroVideoFile) {
      const outroFileName = `outro_${timestamp}.${outroVideoFile.name.split('.').pop()}`
      const outroPath = join(tempDir, outroFileName)
      await unlink(outroPath).catch(() => {})
    }

    // Cleanup temp files from Supabase
    await supabase.storage.from('videos').remove([`temp/${inputFileName}`])
    if (outroVideoFile) {
      await supabase.storage.from('videos').remove([`temp/${outroFileName}`])
    }

    // Return public URL
    return NextResponse.json({
      success: true,
      url: publicUrl
    })

  } catch (error) {
    console.error('Error processing video:', error)
    return NextResponse.json(
      { error: 'Failed to process video', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
