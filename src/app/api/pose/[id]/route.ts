import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { db } = await connectDB();

    const analysis = await db.collection('analyses').findOne({
      _id: new ObjectId(params.id),
      userId: new ObjectId(decoded.userId),
    });

    if (!analysis) {
      return NextResponse.json(
        { error: '分析记录不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      analysis: {
        ...analysis,
        _id: analysis._id.toString(),
        userId: analysis.userId.toString(),
      },
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    return NextResponse.json(
      { error: '获取分析结果失败' },
      { status: 500 }
    );
  }
}
