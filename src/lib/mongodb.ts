// MongoDB 连接管理（懒加载，连接失败不会崩溃）
import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pose-detection';
const options = {};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  if (process.env.NODE_ENV === 'development') {
    // 开发环境：使用全局变量避免热重载时创建多个连接
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export default { then: (resolve: any, reject: any) => getClientPromise().then(resolve, reject) } as Promise<MongoClient>;

// 获取数据库实例
export async function getDatabase(): Promise<Db> {
  const client = await getClientPromise();
  return client.db('pose-detection');
}

// 连接数据库并返回 db 实例
export async function connectDB(): Promise<{ db: Db; client: MongoClient }> {
  const client = await getClientPromise();
  const db = client.db('pose-detection');
  return { db, client };
}

// 集合名称
export const Collections = {
  USERS: 'users',
  POSE_RESULTS: 'pose_results',
  SESSIONS: 'sessions',
} as const;
