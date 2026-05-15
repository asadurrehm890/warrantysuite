// app/routes/api.upload-claim-files.jsx
// Storefront endpoint — called via App Proxy
// (https://<shop>.myshopify.com/apps/warranty/api/upload-claim-files).
import { v2 as cloudinary } from "cloudinary";
import prisma from "../db.server";
import { decryptSecret } from "../utils/crypto.server";
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

async function configureCloudinaryForShop(shop) {
  const settings = await prisma.warrantySettings.findUnique({ where: { shop } });
  if (!settings) {
    throw new Error(
      "Cloudinary configuration not found for this shop. Please configure it in the app settings."
    );
  }

  const cloudName = settings.cloudName;
  const cloudinaryKey = settings.cloudinaryKey;
  const cloudinarySecret = decryptSecret(settings.cloudinarySecret);

  if (!cloudName || !cloudinaryKey || !cloudinarySecret) {
    throw new Error(
      "Incomplete Cloudinary configuration for this shop. Please fill all fields in the app settings."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: cloudinaryKey,
    api_secret: cloudinarySecret,
    secure: true,
  });
}

export const action = proxyEndpoint(async ({ session, request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const shop = session.shop;

  try {
    await configureCloudinaryForShop(shop);

    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return Response.json({ error: "No files uploaded" }, { status: 400 });
    }
    if (files.length > 5) {
      return Response.json({ error: "Maximum 5 files allowed" }, { status: 400 });
    }

    const fileUrls = [];
    const uploadErrors = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        uploadErrors.push(`${file.name} exceeds 10MB limit`);
        continue;
      }

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        uploadErrors.push(`${file.name} has unsupported file type`);
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64String = buffer.toString("base64");
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const publicId = `warranty-claims/${shop}/${timestamp}-${safeFileName.split(".")[0]}`;

        const uploadResult = await cloudinary.uploader.upload(
          `data:${file.type};base64,${base64String}`,
          {
            public_id: publicId,
            resource_type: "auto",
            folder: "warranty-claims",
            tags: ["warranty-claim", shop],
            context: {
              caption: `Warranty claim upload from ${shop}`,
              alt: file.name,
            },
            transformation: [
              { quality: "auto:good" },
              { fetch_format: "auto" },
            ],
          }
        );

        fileUrls.push({
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          format: uploadResult.format,
          size: uploadResult.bytes,
          original_name: file.name,
        });
      } catch (uploadError) {
        console.error(`Error uploading ${file.name}:`, uploadError.message);
        uploadErrors.push(`Failed to upload ${file.name}`);
      }
    }

    if (fileUrls.length === 0) {
      return Response.json(
        { error: "No files were uploaded successfully", errors: uploadErrors },
        { status: 400 }
      );
    }

    return {
      success: true,
      fileUrls: fileUrls.map((f) => f.url),
      fileDetails: fileUrls,
      ...(uploadErrors.length > 0 ? { errors: uploadErrors } : {}),
    };
  } catch (error) {
    console.error("Error in file upload endpoint:", error.message);
    return Response.json(
      { error: "Failed to process upload request" },
      { status: 500 }
    );
  }
});
