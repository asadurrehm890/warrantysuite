// api/upload-claim-files.jsx
import { v2 as cloudinary } from "cloudinary";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * Helper: configure Cloudinary for the current shop from DB
 */
async function configureCloudinaryForShop(shop) {
  const settings = await prisma.warrantySettings.findUnique({
    where: { shop },
  });

  if (!settings) {
    throw new Error(
      "Cloudinary configuration not found for this shop. Please configure it in the app settings."
    );
  }

  const { cloudName, cloudinaryKey, cloudinarySecret } = settings;

  if (!cloudName || !cloudinaryKey || !cloudinarySecret) {
    throw new Error(
      "Incomplete Cloudinary configuration for this shop. Please fill all fields in the app settings."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: cloudinaryKey,
    api_secret: cloudinarySecret,
    secure: true, // Force HTTPS URLs
  });
}

export async function action({ request }) {
  // Only allow POST requests
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Authenticate and get the shop from the session
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    // Configure Cloudinary for this shop from DB
    await configureCloudinaryForShop(shop);

    // Parse the multipart form data
    const formData = await request.formData();
    const files = formData.getAll("files");

    // Validate files
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check file count limit (max 5 files)
    if (files.length > 5) {
      return new Response(
        JSON.stringify({ error: "Maximum 5 files allowed" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const fileUrls = [];
    const uploadErrors = [];

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file size (max 10MB per file)
      if (file.size > 10 * 1024 * 1024) {
        uploadErrors.push(`${file.name} exceeds 10MB limit`);
        continue;
      }

      // Validate file type
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
        // Convert file to buffer and then to base64
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64String = buffer.toString("base64");

        // Generate a unique filename
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "_"); // Remove special chars
        const publicId = `warranty-claims/${shop}/${timestamp}-${
          safeFileName.split(".")[0]
        }`;

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(
          `data:${file.type};base64,${base64String}`,
          {
            public_id: publicId,
            resource_type: "auto", // Auto-detect file type (image, pdf, etc.)
            folder: "warranty-claims", // Optional: organizes files in folders
            tags: ["warranty-claim", shop],
            context: {
              caption: `Warranty claim upload from ${shop}`,
              alt: file.name,
            },
            // Optional transformations for images
            transformation: [
              { quality: "auto:good" }, // Auto optimize quality
              { fetch_format: "auto" }, // Auto convert to best format
            ],
          }
        );

        // Store the secure URL
        fileUrls.push({
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          format: uploadResult.format,
          size: uploadResult.bytes,
          original_name: file.name,
        });

        console.log(
          `Successfully uploaded: ${file.name} -> ${uploadResult.secure_url}`
        );
      } catch (uploadError) {
        console.error(`Error uploading ${file.name}:`, uploadError);
        uploadErrors.push(
          `Failed to upload ${file.name}: ${uploadError.message}`
        );
      }
    }

    // Prepare response
    const response = {
      success: fileUrls.length > 0,
      fileUrls: fileUrls.map((f) => f.url), // Simple array of URLs for your form
      fileDetails: fileUrls, // Detailed info if needed
    };

    if (uploadErrors.length > 0) {
      response.errors = uploadErrors;
    }

    if (fileUrls.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No files were uploaded successfully",
          errors: uploadErrors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in file upload endpoint:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process upload request",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Optional: Add a GET endpoint to retrieve uploaded files info
export async function loader({ request }) {
  try {
    // Authenticate and get the shop from the session (if you want per-shop Cloudinary)
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    // Configure Cloudinary for this shop from DB
    await configureCloudinaryForShop(shop);

    const url = new URL(request.url);
    const publicId = url.searchParams.get("public_id");

    if (!publicId) {
      return new Response(JSON.stringify({ error: "public_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get image/file details from Cloudinary
    const result = await cloudinary.api.resource(publicId, {
      colors: true,
      image_metadata: true,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching from Cloudinary:", error);
    return new Response(JSON.stringify({ error: "File not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}