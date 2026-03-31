import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'Token无效或已过期' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisId, results } = body;

    if (!analysisId || !results) {
      return NextResponse.json(
        { error: '分析ID和结果都是必填的' },
        { status: 400 }
      );
    }

    const { db } = await connectDB();

    const updateResult = await db.collection('analyses').updateOne(
      {
        _id: new ObjectId(analysisId),
        userId: new ObjectId(decoded.userId),
      },
      {
        $set: {
          status: 'completed',
          results,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: '分析记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '分析结果已保存' });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: '保存失败，请稍后重试' },
      { status: 500 }
    );
  }
}
