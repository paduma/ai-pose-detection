import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: 'Token无效或已过期' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const exerciseType = formData.get('exerciseType') as string;

    if (!videoFile || !exerciseType) {
      return NextResponse.json(
        { error: '视频文件和运动类型都是必填的' },
        { status: 400 }
      );
    }

    // Save video metadata to database
    const { db } = await connectDB();

    const analysis = {
      userId: new ObjectId(decoded.userId),
      exerciseType,
      videoFileName: videoFile.name,
      videoSize: videoFile.size,
      status: 'pending', // 前端会处理实际分析
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('analyses').insertOne(analysis);

    return NextResponse.json({
      message: '分析ID已创建，请在前端进行视频分析',
      analysisId: result.insertedId.toString(),
      videoFile: videoFile.name,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: '分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
