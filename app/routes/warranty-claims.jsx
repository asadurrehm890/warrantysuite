import React, { useState, useEffect } from "react";
import Select from "react-select";
import "../styles/warranty-claim.css";

export default function WarrantyClaimPage() {
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpToken, setOtpToken] = useState(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState(null);
  const [statusType, setStatusType] = useState(null);
  const [otpSent, setOtpSent] = useState(false);

  const [warranties, setWarranties] = useState([]);
  const [warrantiesLoading, setWarrantiesLoading] = useState(false);
  const [warrantiesError, setWarrantiesError] = useState(null);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [selectedWarrantyDetails, setSelectedWarrantyDetails] = useState(null);

  const [claimDescription, setClaimDescription] = useState("");
  const [claimType, setClaimType] = useState(null);
  const [files, setFiles] = useState([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [shopDomain, setShopDomain] = useState("store.myshopify.com");

  // NEW: claim marketing text (default matches admin default)
  const [claimMarketingText, setClaimMarketingText] = useState(
    "Keep me updated on my claim status via email"
  );

  // Cloudinary Free Plan Limits
  const CLOUDINARY_LIMITS = {
    MAX_FILE_SIZE: 1 * 1024 * 1024, // 10MB
    MAX_IMAGE_SIZE: 1 * 1024 * 1024, // 10MB for images
    MAX_RAW_SIZE: 1 * 1024 * 1024, // 10MB for raw files (PDFs)
    MAX_FILES: 5, // Max files per submission
    ALLOWED_IMAGE_TYPES: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ],
    ALLOWED_RAW_TYPES: ["application/pdf"],
    MAX_DIMENSIONS: {
      width: 2500, // Reasonable limit for 25MP (approx 5000x5000)
      height: 2500,
    },
  };

  // Claim type options for react-select
  const claimTypeOptions = [
    { value: "defective", label: "Product Defective" },
    { value: "damaged", label: "Product Damaged" },
    { value: "missing_parts", label: "Missing Parts" },
    { value: "not_working", label: "Not Working as Expected" },
    { value: "other", label: "Other Issue" },
  ];

  // Custom styles for react-select
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "45px",
      borderColor: state.isFocused ? "#007bff" : "#ced4da",
      boxShadow: state.isFocused
        ? "0 0 0 0.2rem rgba(0,123,255,.25)"
        : null,
      "&:hover": {
        borderColor: "#007bff",
      },
    }),
    menu: (base) => ({
      ...base,
      zIndex: 100,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "#007bff"
        : state.isFocused
        ? "#e6f2ff"
        : "white",
      color: state.isSelected ? "white" : "black",
      cursor: "pointer",
      "&:active": {
        backgroundColor: state.isSelected ? "#007bff" : "#b3d9ff",
      },
    }),
    placeholder: (base) => ({
      ...base,
      color: "#999",
    }),
  };

  // Read shop from URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const shopFromUrl = params.get("shop");
      if (shopFromUrl) {
        setShopDomain(shopFromUrl);
      }
    } catch (e) {
      console.warn("Could not read shop from URL, using default", e);
    }
  }, []);

  // NEW: fetch warranty settings (including claim marketing text)
  useEffect(() => {
    const fetchWarrantySettings = async () => {
      if (!shopDomain) return;

      try {
        const res = await fetch(
          `/api/warranty-settings?shop=${encodeURIComponent(shopDomain)}`
        );
        if (!res.ok) {
          console.warn("Failed to load warranty settings");
          return;
        }
        const data = await res.json();

        if (data.claimMarketingText) {
          setClaimMarketingText(data.claimMarketingText);
        }
        // If you ever want registration marketing text here as well:
        // if (data.marketingText) { ... }
      } catch (err) {
        console.error("Error fetching warranty settings:", err);
      }
    };

    fetchWarrantySettings();
  }, [shopDomain]);

  // Fetch customer's warranties after email verification
  useEffect(() => {
    const fetchCustomerWarranties = async () => {
      if (!emailVerified || !email) return;

      try {
        setWarrantiesLoading(true);
        setWarrantiesError(null);

        const res = await fetch(
          `/api/customer-warranties?email=${encodeURIComponent(
            email
          )}&shop=${encodeURIComponent(shopDomain)}`
        );

        if (!res.ok) {
          throw new Error("Failed to load warranties");
        }

        const data = await res.json();
        setWarranties(data.warranties || []);
      } catch (err) {
        console.error("Error fetching warranties:", err);
        setWarrantiesError("Failed to load your warranties");
      } finally {
        setWarrantiesLoading(false);
      }
    };

    fetchCustomerWarranties();
  }, [emailVerified, email, shopDomain]);

  // Transform warranties for react-select
  const getWarrantyOptions = () => {
    return warranties.map((warranty) => ({
      value: warranty.id,
      label: `${warranty.product_name} - ${
        warranty.order_number
      } (Purchased: ${new Date(
        warranty.purchase_date
      ).toLocaleDateString()})`,
      details: warranty,
    }));
  };

  // Handle warranty selection
  const handleWarrantySelect = (selectedOption) => {
    setSelectedWarranty(selectedOption);
    setSelectedWarrantyDetails(
      selectedOption ? selectedOption.details : null
    );
  };

  // Handle claim type selection
  const handleClaimTypeSelect = (selectedOption) => {
    setClaimType(selectedOption);
  };

  // Check image dimensions (optional - if you want to be extra safe)
  const checkImageDimensions = (file) => {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/")) {
        resolve(true);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const isValid =
          img.width <= CLOUDINARY_LIMITS.MAX_DIMENSIONS.width &&
          img.height <= CLOUDINARY_LIMITS.MAX_DIMENSIONS.height;
        resolve(isValid);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };

      img.src = objectUrl;
    });
  };

  // Handle file selection with Cloudinary free plan validation
  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);

    // Validate file count
    if (selectedFiles.length > CLOUDINARY_LIMITS.MAX_FILES) {
      setStatus(
        `Maximum ${CLOUDINARY_LIMITS.MAX_FILES} files allowed (Cloudinary free plan limit)`
      );
      setStatusType("error");
      return;
    }

    // Validate each file
    const validFiles = [];
    const invalidFiles = [];

    for (const file of selectedFiles) {
      // Check file size based on type
      const isImage = file.type.startsWith("image/");
      const maxSize = isImage
        ? CLOUDINARY_LIMITS.MAX_IMAGE_SIZE
        : CLOUDINARY_LIMITS.MAX_RAW_SIZE;

      if (file.size > maxSize) {
        invalidFiles.push(
          `${file.name} (exceeds ${
            maxSize / (1024 * 1024)
          }MB limit)`
        );
        continue;
      }

      // Check file type
      const allowedTypes = [
        ...CLOUDINARY_LIMITS.ALLOWED_IMAGE_TYPES,
        ...CLOUDINARY_LIMITS.ALLOWED_RAW_TYPES,
      ];
      if (!allowedTypes.includes(file.type)) {
        invalidFiles.push(
          `${file.name} (unsupported type - use JPG, PNG, GIF, WEBP, or PDF)`
        );
        continue;
      }

      // For images, check approximate dimensions (optional but recommended)
      if (isImage) {
        const validDimensions = await checkImageDimensions(file);
        if (!validDimensions) {
          invalidFiles.push(
            `${file.name} (image dimensions too large - max 2500x2500 recommended for free plan)`
          );
          continue;
        }
      }

      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      setStatus(`Invalid files: ${invalidFiles.join(", ")}`);
      setStatusType("error");
    }

    setFiles(validFiles);

    // Reset progress for new files
    const newProgress = {};
    validFiles.forEach((file) => {
      newProgress[file.name] = 0;
    });
    setUploadProgress(newProgress);
  };

  // Remove a file from the selection
  const handleRemoveFile = (fileName) => {
    setFiles(files.filter((file) => file.name !== fileName));
    setUploadProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
  };

  // Handle file upload with progress tracking
  const uploadFiles = async () => {
    if (files.length === 0) return [];

    setFileUploading(true);
    const uploadedUrls = [];
    const failedFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("files", file);
      formData.append("shop", shopDomain);

      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 10 }));

        const res = await fetch("/api/upload-claim-files", {
          method: "POST",
          body: formData,
        });

        setUploadProgress((prev) => ({ ...prev, [file.name]: 60 }));

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Failed to upload ${file.name}`);
        }

        const data = await res.json();

        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));

        if (data.fileUrls && data.fileUrls.length > 0) {
          uploadedUrls.push({
            url: data.fileUrls[0],
            name: file.name,
            type: file.type,
            size: file.size,
          });
        } else {
          failedFiles.push(file.name);
        }
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
        failedFiles.push(file.name);
        setStatus(err.message);
        setStatusType("error");
      }
    }

    setFileUploading(false);
    setUploadedFiles(uploadedUrls);

    if (failedFiles.length > 0) {
      setStatus(`Failed to upload: ${failedFiles.join(", ")}`);
      setStatusType("error");
    }

    return uploadedUrls.map((f) => f.url);
  };

  async function handleSendOtp(e) {
    e.preventDefault();
    setStatusType(null);
    setStatus("Sending OTP...");
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpToken(data.token);
        setOtpSent(true);
        setStatus("OTP sent. Check your email.");
        setStatusType("success");
      } else {
        setStatus(data.error || "Failed to send OTP.");
        setStatusType("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to send OTP.");
      setStatusType("error");
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setStatusType(null);
    setStatus("Verifying OTP...");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, token: otpToken }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setEmailVerified(true);
        setStatus("Email verified.");
        setStatusType("success");
        setOtpSent(false);
      } else {
        setStatus(data.error || "Invalid OTP.");
        setStatusType("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to verify OTP.");
      setStatusType("error");
    }
  }

  function handleEditEmail() {
    setEmailVerified(false);
    setOtpSent(false);
    setOtpToken(null);
    setOtp("");
    setStatus(null);
    setStatusType(null);
    setWarranties([]);
    setSelectedWarranty(null);
    setSelectedWarrantyDetails(null);
    setFiles([]);
    setUploadProgress({});
    setUploadedFiles([]);
    setClaimType(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!emailVerified) {
      setStatus("Please verify your email first.");
      setStatusType("error");
      return;
    }

    if (!selectedWarranty) {
      setStatus("Please select a warranty to claim.");
      setStatusType("error");
      return;
    }

    if (!claimDescription.trim()) {
      setStatus("Please describe the issue with your product.");
      setStatusType("error");
      return;
    }

    if (!claimType) {
      setStatus("Please select the type of issue.");
      setStatusType("error");
      return;
    }

    setStatusType(null);
    setStatus("Submitting warranty claim...");

    try {
      // Upload files if any
      let fileUrls = [];
      if (files.length > 0) {
        setStatus(
          "Uploading files to Cloudinary (free plan - max 10MB per file)..."
        );
        fileUrls = await uploadFiles();
      }

      const claimData = {
        email,
        warrantyId: selectedWarranty.value,
        warranty: selectedWarrantyDetails,
        claimType: claimType.value,
        claimDescription,
        fileUrls,
        fileDetails: uploadedFiles,
        otpToken,
        submittedAt: new Date().toISOString(),
      };

      setStatus("Submitting claim...");

      const res = await fetch(
        `/api/submit-warranty-claim?shop=${encodeURIComponent(
          shopDomain
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(claimData),
        }
      );

      const data = await res.json();

      if (res.ok) {
        setStatus("Warranty claim submitted successfully!");
        setStatusType("success");

        // Clear form
        setFiles([]);
        setUploadProgress({});
        setUploadedFiles([]);
        setClaimDescription("");
        setClaimType(null);
        setSelectedWarranty(null);
        setSelectedWarrantyDetails(null);

        // Redirect to thank you page after delay
        setTimeout(() => {
          window.location.href = `/claim-thankyou?shop=${encodeURIComponent(
            shopDomain
          )}`;
        }, 2000);
      } else {
        setStatus(data.error || "Failed to submit warranty claim.");
        setStatusType("error");
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Failed to submit warranty claim.");
      setStatusType("error");
    }
  }

  // Calculate total file size
  const getTotalFileSize = () => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  return (
    <main className="warranty-claim-page">
      <section className="warranty-claim-section">
        <form className="warranty-claim-form" onSubmit={handleSubmit}>
          {/* Email Verification Section */}
          <div className="email-verification-section">
            {!emailVerified && (
              <>
                {!otpSent ? (
                  <>
                    <div className="warranty-claim-field">
                      <label htmlFor="claim-email">Email Address</label>
                      <input
                        id="claim-email"
                        className="warranty-claim-input"
                        type="email"
                        required
                        value={email}
                        placeholder="Enter your email"
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="warranty-claim-actions">
                      <button
                        className="warranty-claim-button"
                        onClick={handleSendOtp}
                        disabled={!email.trim()}
                        type="button"
                      >
                        Send Verification Code
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="warranty-claim-field">
                      <label htmlFor="claim-otp">
                        Enter Verification Code
                      </label>
                      <input
                        id="claim-otp"
                        className="warranty-claim-input"
                        type="text"
                        required
                        value={otp}
                        placeholder="Enter OTP"
                        onChange={(e) => setOtp(e.target.value)}
                      />
                    </div>
                    <div className="warranty-claim-actions">
                      <button
                        className="warranty-claim-button secondary"
                        onClick={handleVerifyOtp}
                        disabled={!otp.trim()}
                        type="button"
                      >
                        Verify Code
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {emailVerified && (
              <div className="verification-success">
                <p>✓ Email verified successfully!</p>
                <button
                  className="warranty-claim-button small secondary"
                  onClick={handleEditEmail}
                  type="button"
                >
                  Change Email
                </button>
              </div>
            )}
          </div>

          {/* Warranty Selection Section - Only show after email verification */}
          {emailVerified && (
            <>
              <div className="warranty-claim-field">
                <label htmlFor="warranty_select">
                  Select Product for Claim
                </label>

                {warrantiesLoading && (
                  <p className="loading-message">
                    Loading your warranties...
                  </p>
                )}

                {warrantiesError && (
                  <p className="error-message">{warrantiesError}</p>
                )}

                {!warrantiesLoading &&
                  !warrantiesError &&
                  warranties.length === 0 && (
                    <div className="no-warranties-message">
                      <p>No warranties found for this email address.</p>
                      <p>
                        Please make sure you've registered your product
                        first.
                      </p>
                    </div>
                  )}

                {!warrantiesLoading &&
                  !warrantiesError &&
                  warranties.length > 0 && (
                    <Select
                      id="warranty_select"
                      options={getWarrantyOptions()}
                      value={selectedWarranty}
                      onChange={handleWarrantySelect}
                      placeholder="Select a product..."
                      isClearable
                      isSearchable
                      styles={selectStyles}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      noOptionsMessage={() => "No products found"}
                      loadingMessage={() => "Loading products..."}
                      isLoading={warrantiesLoading}
                    />
                  )}
              </div>

              {/* Selected Warranty Details */}
              {selectedWarrantyDetails && (
                <div className="selected-warranty-details">
                  <h3>Selected Product Details</h3>
                  <p>
                    <strong>Product:</strong>{" "}
                    {selectedWarrantyDetails.product_name}
                  </p>
                  <p>
                    <strong>Order Number:</strong>{" "}
                    {selectedWarrantyDetails.order_number}
                  </p>
                  <p>
                    <strong>Purchase Date:</strong>{" "}
                    {new Date(
                      selectedWarrantyDetails.purchase_date
                    ).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Serial Number:</strong>{" "}
                    {selectedWarrantyDetails.serial_number}
                  </p>
                </div>
              )}

              {/* Claim Type Selection */}
              <div className="warranty-claim-field">
                <label htmlFor="claim_type">Type of Issue</label>
                <Select
                  id="claim_type"
                  options={claimTypeOptions}
                  value={claimType}
                  onChange={handleClaimTypeSelect}
                  placeholder="Select issue type..."
                  isClearable
                  isSearchable
                  styles={selectStyles}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  noOptionsMessage={() => "No options available"}
                />
              </div>

              {/* Claim Description */}
              <div className="warranty-claim-field">
                <label htmlFor="claim_description">
                  Describe the Issue
                </label>
                <textarea
                  id="claim_description"
                  className="warranty-claim-textarea"
                  value={claimDescription}
                  onChange={(e) =>
                    setClaimDescription(e.target.value)
                  }
                  placeholder="Please describe what's wrong with your product in detail..."
                  rows="6"
                  required
                />
              </div>

              {/* Enhanced File Upload Section with Cloudinary Free Plan Limits */}
              <div className="warranty-claim-field">
                <label htmlFor="claim_files">
                  Supporting Photos/Documents
                  <span className="optional-label"> (Optional)</span>
                </label>

                <div className="file-upload-container">
                  <input
                    id="claim_files"
                    className="warranty-claim-file-input"
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                    onChange={handleFileChange}
                    disabled={fileUploading}
                  />

                  <div className="file-upload-info">
                    <div className="file-limits">
                      <span className="limit-badge">
                        📦 Max {CLOUDINARY_LIMITS.MAX_FILES} files
                      </span>
                      <span className="limit-badge">
                        ⚡ Max 10MB per file
                      </span>
                      <span className="limit-badge">
                        🖼️ JPG, PNG, GIF, WEBP, PDF
                      </span>
                    </div>
                  </div>
                </div>

                {/* File counter and size summary */}
                {files.length > 0 && (
                  <div className="file-summary">
                    <span className="file-count">
                      {files.length} of {CLOUDINARY_LIMITS.MAX_FILES} files
                      selected
                    </span>
                    <span className="file-total-size">
                      Total: {formatFileSize(getTotalFileSize())}
                    </span>
                  </div>
                )}

                {/* Selected Files with Progress */}
                {files.length > 0 && (
                  <div className="selected-files">
                    <p>
                      <strong>Selected files:</strong>
                    </p>
                    <ul className="file-list">
                      {files.map((file, index) => (
                        <li key={index} className="file-item">
                          <div className="file-info">
                            <span className="file-name">
                              {file.name}
                            </span>
                            <span className="file-size">
                              ({formatFileSize(file.size)})
                            </span>
                            {file.type.startsWith("image/") && (
                              <span className="file-type-badge">
                                📷 Image
                              </span>
                            )}
                            {file.type === "application/pdf" && (
                              <span className="file-type-badge">
                                📄 PDF
                              </span>
                            )}
                          </div>

                          <div className="file-status">
                            {uploadProgress[file.name] === 100 && (
                              <span className="upload-success">
                                ✓ Uploaded to Cloudinary
                              </span>
                            )}
                            {uploadProgress[file.name] === -1 && (
                              <span className="upload-error">
                                ✗ Upload failed
                              </span>
                            )}
                            {fileUploading &&
                              uploadProgress[file.name] > 0 &&
                              uploadProgress[file.name] < 100 && (
                                <div className="progress-container">
                                  <div
                                    className="progress-bar"
                                    style={{
                                      width: `${uploadProgress[file.name]}%`,
                                    }}
                                  />
                                  <span className="progress-text">
                                    {uploadProgress[file.name]}%
                                  </span>
                                </div>
                              )}
                            {!fileUploading &&
                              uploadProgress[file.name] === 0 && (
                                <button
                                  type="button"
                                  className="remove-file-button"
                                  onClick={() =>
                                    handleRemoveFile(file.name)
                                  }
                                >
                                  ✕ Remove
                                </button>
                              )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Uploaded Files Summary */}
                {uploadedFiles.length > 0 && (
                  <div className="uploaded-files-summary">
                    <p>
                      <strong>✓ Uploaded to Cloudinary:</strong>
                    </p>
                    <ul>
                      {uploadedFiles.map((file, index) => (
                        <li key={index}>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="uploaded-file-link"
                          >
                            {file.name} (
                            {formatFileSize(file.size)})
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="warranty-claim-actions">
                <button
                  className="warranty-claim-button"
                  type="submit"
                  disabled={
                    !emailVerified ||
                    !selectedWarranty ||
                    !claimDescription ||
                    !claimType ||
                    fileUploading
                  }
                >
                  {fileUploading ? (
                    <span className="button-with-spinner">
                      <span className="spinner"></span>
                      Uploading to Cloudinary...
                    </span>
                  ) : (
                    "Submit Warranty Claim"
                  )}
                </button>
              </div>

              {/* Marketing Consent (now dynamic) */}
              <p className="flexpara">
                <input
                  type="checkbox"
                  name="termsformarketing"
                  id="termsformarketing"
                  defaultChecked
                />
                <label htmlFor="termsformarketing">
                  {claimMarketingText}
                </label>
              </p>
            </>
          )}

          {/* Status Messages */}
          {status && (
            <div
              className={
                "warranty-claim-status " +
                (statusType === "error"
                  ? "warranty-claim-status--error"
                  : statusType === "success"
                  ? "warranty-claim-status--success"
                  : "warranty-claim-status--info")
              }
            >
              {status}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}