const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const s3Config = {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: true,
};

const s3Client = new S3Client(s3Config);
const BUCKET = process.env.S3_BUCKET;
const PUBLIC_URL = process.env.S3_PUBLIC_URL;

const generateFileName = (originalName) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = originalName.split('.').pop();
    return `${timestamp}-${random}.${ext}`;
};

const uploadFile = async (fileBuffer, originalName, mimeType) => {
    const fileName = generateFileName(originalName);
    const key = `uploads/${fileName}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: 'public-read',
    });

    await s3Client.send(command);

    return {
        key,
        url: `${PUBLIC_URL}/${key}`,
        fileName: fileName,
    };
};

const deleteFile = async (key) => {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });
    await s3Client.send(command);
    return true;
};

module.exports = { uploadFile, deleteFile };