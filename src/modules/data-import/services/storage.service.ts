import { Client } from "minio";

let minioClient: Client | null = null;

function getMinioClient(): Client {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT || "9000", 10),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    });
  }
  return minioClient;
}

const BUCKET = process.env.MINIO_BUCKET || "ctut-ewars-data";

/**
 * Đảm bảo bucket tồn tại, tạo nếu chưa có.
 */
async function ensureBucket(): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, "us-east-1");
  }
}

/**
 * Upload file gốc nhập liệu lên MinIO.
 * Trả về đường dẫn object trong MinIO.
 */
export async function uploadOriginalFile(params: {
  fileName: string;
  content: Buffer;
  dataType: string;
}): Promise<string> {
  await ensureBucket();
  const client = getMinioClient();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const objectName = `imports/${params.dataType}/${timestamp}_${params.fileName}`;

  await client.putObject(BUCKET, objectName, params.content, params.content.length, {
    "Content-Type": "text/csv",
    "X-Import-DataType": params.dataType,
  });

  return objectName;
}

/**
 * Tải file gốc từ MinIO.
 */
export async function downloadOriginalFile(objectName: string): Promise<Buffer> {
  const client = getMinioClient();
  const stream = await client.getObject(BUCKET, objectName);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
