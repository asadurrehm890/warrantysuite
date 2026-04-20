import React, { useState, useEffect } from "react";
import "../styles/warranty.css";
import { findFlagUrlByIso2Code } from "country-flags-svg";
import Select from "react-select";

export default function WarrantyPage() {
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpToken, setOtpToken] = useState(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState(null);
  const [statusType, setStatusType] = useState(null);
  const [otpSent, setOtpSent] = useState(false);

  // New states for customer data
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [existingCustomerData, setExistingCustomerData] = useState(null);
  const [showExistingCustomerMessage, setShowExistingCustomerMessage] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState("");

  // NEW: product typeahead states
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Address states
  const [addressSearch, setAddressSearch] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [addressFields, setAddressFields] = useState({
    street: "",
    town: "",
    country: "",
    postal_code: "",
  });

  // Phone number states - UPDATED
  const [phoneCountryCode, setPhoneCountryCode] = useState("+44");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  // Purchase sources state
  const [purchaseSources, setPurchaseSources] = useState([]);
  const [purchaseSourcesLoading, setPurchaseSourcesLoading] = useState(true);
  const [purchaseSourcesError, setPurchaseSourcesError] = useState(null);
  const [selectedPurchaseSource, setSelectedPurchaseSource] = useState(null);

  const [shopDomain, setShopDomain] = useState("store.myshopify.com"); // Default value, will be overridden by URL param if present
  
  const [marketingText, setMarketingText] = useState("");
  const [marketingTextLoading, setMarketingTextLoading] = useState(true);
  const [marketingTextError, setMarketingTextError] = useState(null);

  // Fetch marketing consent text
  useEffect(() => {
    const fetchMarketingText = async () => {
      try {
        setMarketingTextLoading(true);
        setMarketingTextError(null);

        const res = await fetch(
          `/api/warranty-settings?shop=${encodeURIComponent(shopDomain)}`
        );
        if (!res.ok) {
          throw new Error("Failed to load marketing text");
        }
        const data = await res.json();
        setMarketingText(data.marketingText || "");
      } catch (err) {
        console.error("Error fetching marketing text:", err);
        setMarketingTextError("Failed to load marketing text");
      } finally {
        setMarketingTextLoading(false);
      }
    };

    if (shopDomain) {
      fetchMarketingText();
    }
  }, [shopDomain]);
  
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

  // Fetch purchase sources for this shop
  useEffect(() => {
    const fetchPurchaseSources = async () => {
      try {
        setPurchaseSourcesLoading(true);
        setPurchaseSourcesError(null);

        const res = await fetch(
          `/api/purchase-sources?shop=${encodeURIComponent(shopDomain)}`
        );
        if (!res.ok) {
          throw new Error("Failed to load purchase sources");
        }
        const data = await res.json();
        setPurchaseSources(data.sources || []);
      } catch (err) {
        console.error("Error fetching purchase sources:", err);
        setPurchaseSourcesError("Failed to load purchase sources");
      } finally {
        setPurchaseSourcesLoading(false);
      }
    };

    if (shopDomain) {
      fetchPurchaseSources();
    }
  }, [shopDomain]);

  const purchaseSourceOptions = purchaseSources.map((source) => ({
    value: source.label, // what will be submitted in the form
    label: source.label,
  }));
  
  purchaseSourceOptions.push({ value: shopDomain, label: shopDomain }); // Add "Other" option at the end

  // Static fallback list for countries - accurate phone codes
  const staticCountries = [
    { code: "+44", country: "United Kingdom", flag: "🇬🇧", isoCode: "GB" },
    { code: "+1", country: "United States", flag: "🇺🇸", isoCode: "US" },
    { code: "+61", country: "Australia", flag: "🇦🇺", isoCode: "AU" },
    { code: "+91", country: "India", flag: "🇮🇳", isoCode: "IN" },
    { code: "+49", country: "Germany", flag: "🇩🇪", isoCode: "DE" },
    { code: "+33", country: "France", flag: "🇫🇷", isoCode: "FR" },
    { code: "+86", country: "China", flag: "🇨🇳", isoCode: "CN" },
    { code: "+81", country: "Japan", flag: "🇯🇵", isoCode: "JP" },
    { code: "+65", country: "Singapore", flag: "🇸🇬", isoCode: "SG" },
    { code: "+971", country: "United Arab Emirates", flag: "🇦🇪", isoCode: "AE" },
    { code: "+41", country: "Switzerland", flag: "🇨🇭", isoCode: "CH" },
    { code: "+39", country: "Italy", flag: "🇮🇹", isoCode: "IT" },
    { code: "+34", country: "Spain", flag: "🇪🇸", isoCode: "ES" },
    { code: "+31", country: "Netherlands", flag: "🇳🇱", isoCode: "NL" },
    { code: "+32", country: "Belgium", flag: "🇧🇪", isoCode: "BE" },
    { code: "+46", country: "Sweden", flag: "🇸🇪", isoCode: "SE" },
    { code: "+47", country: "Norway", flag: "🇳🇴", isoCode: "NO" },
    { code: "+45", country: "Denmark", flag: "🇩🇰", isoCode: "DK" },
    { code: "+358", country: "Finland", flag: "🇫🇮", isoCode: "FI" },
    { code: "+353", country: "Ireland", flag: "🇮🇪", isoCode: "IE" },
  ];

  // Ideal Postcodes API Key - Add this at the top with your actual key
  const IDEAL_POSTCODES_API_KEY = "ak_test"; // Replace with your key from ideal-postcodes.co.uk

  // Fetch countries from better API
  useEffect(() => {
    const fetchCountries = async () => {
      setCountriesLoading(true);
      try {
        const response = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,cca2,idd,flags"
        );
        const data = await response.json();

        const formattedCountries = data
          .filter((country) => {
            return country.idd && country.idd.root;
          })
          .map((country) => {
            let phoneCode = country.idd.root;

            if (country.idd.suffixes && country.idd.suffixes.length > 0) {
              phoneCode = phoneCode + (country.idd.suffixes[0] || "");
            }

            phoneCode = phoneCode.replace(/\s+/g, "");

            const getFlagEmoji = (countryCode) => {
              if (!countryCode || countryCode.length !== 2) return "🏳️";
              const codePoints = countryCode
                .toUpperCase()
                .split("")
                .map((char) => 127397 + char.charCodeAt());
              return String.fromCodePoint(...codePoints);
            };

            return {
              code: phoneCode,
              country: country.name.common,
              flag: getFlagEmoji(country.cca2),
              isoCode: country.cca2,
            };
          })
          .filter((country) => {
            return (
              country.code &&
              country.code !== "+" &&
              country.code.length > 1 &&
              !country.country.includes("Island") &&
              !country.country.includes("Guernsey") &&
              !country.country.includes("Jersey") &&
              !country.country.includes("Isle of Man")
            );
          })
          .sort((a, b) => a.country.localeCompare(b.country));

        setCountries(formattedCountries);
      } catch (error) {
        console.error("Error fetching countries:", error);
        setCountries(staticCountries);
      } finally {
        setCountriesLoading(false);
      }
    };

    fetchCountries();
  }, []);

  // Initialize phone number with default country code
  useEffect(() => {
    setPhoneNumber("+44");
  }, []);

  // Update phone number when country code changes
  useEffect(() => {
    if (!phoneNumber || !phoneNumber.startsWith(phoneCountryCode)) {
      setPhoneNumber(phoneCountryCode);
    }
  }, [phoneCountryCode]);

  // Debounce address search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (addressSearch.trim().length > 2) {
        searchAddresses(addressSearch);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [addressSearch]);

  // Fetch products for the Product Name select (now used for typeahead)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        setProductsError(null);
        const params = new URLSearchParams(window.location.search);
        const shopFromUrl = params.get("shop");

        const res = await fetch("/api/products?shop="+encodeURIComponent(shopFromUrl));
        if (!res.ok) {
          throw new Error("Failed to load products");
        }
        const data = await res.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error("Error fetching products:", err);
        setProductsError("Failed to load products");
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Derived: filtered products based on search term
  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  // Search addresses using Ideal Postcodes API (primary) with OpenStreetMap fallback
  const searchAddresses = async (query) => {
    setIsSearching(true);
    setShowSuggestions(false);
    
    try {
      const response = await fetch(
        `https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses?api_key=${IDEAL_POSTCODES_API_KEY}&query=${encodeURIComponent(
          query
        )}&limit=5`
      );

      const data = await response.json();

      if (data.result && data.result.hits && data.result.hits.length > 0) {
        const formattedSuggestions = data.result.hits.map((hit) => {
          const suggestionParts = hit.suggestion.split(', ');
          let street = suggestionParts[0] || '';
          let town = suggestionParts[2] || '';
          let postalCode = suggestionParts[3] || '';
          
          if (suggestionParts.length > 4) {
            street = suggestionParts.slice(0, 2).join(', ');
            town = suggestionParts[2] || '';
            postalCode = suggestionParts[3] || '';
          }
          
          return {
            display_name: hit.suggestion,
            address: {
              road: street,
              house_number: '',
              city: town,
              town: town,
              country: "United Kingdom",
              postcode: postalCode,
              ideal_postcodes_hit: hit
            }
          };
        });
        
        setAddressSuggestions(formattedSuggestions);
        setShowSuggestions(true);
      } else {
        await searchOpenStreetMap(query);
      }
    } catch (err) {
      console.error("Ideal Postcodes search error:", err);
      await searchOpenStreetMap(query);
    } finally {
      setIsSearching(false);
    }
  };

  // Fallback to OpenStreetMap Nominatim API
  const searchOpenStreetMap = async (query) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=gb&addressdetails=1&limit=5`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "MobitelWarranty/1.0",
          },
        }
      );

      const data = await response.json();

      if (data && data.length > 0) {
        setAddressSuggestions(data);
        setShowSuggestions(true);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (err) {
      console.error("OpenStreetMap search error:", err);
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle address selection
  const handleSelectAddress = async (suggestion) => {
    const address = suggestion.address;
    
    let street = "";
    let town = "";
    let country = "";
    let postalCode = "";

    if (address.ideal_postcodes_hit) {
      const hit = address.ideal_postcodes_hit;
      
      try {
        const udprn = hit.udprn;
        const response = await fetch(
          `https://api.ideal-postcodes.co.uk/v1/udprn/${udprn}?api_key=${IDEAL_POSTCODES_API_KEY}`
        );
        const data = await response.json();
        
        if (data.result) {
          const fullAddress = data.result;
          street = fullAddress.line_1 || "";
          if (fullAddress.line_2) {
            street += `, ${fullAddress.line_2}`;
          }
          town = fullAddress.post_town || "";
          country = "United Kingdom";
          postalCode = fullAddress.postcode || "";
        } else {
          const suggestionParts = hit.suggestion.split(', ');
          street = suggestionParts[0] || '';
          town = suggestionParts[2] || '';
          postalCode = suggestionParts[3] || '';
          country = "United Kingdom";
        }
      } catch (error) {
        console.error("Error fetching full address details:", error);
        const suggestionParts = hit.suggestion.split(', ');
        street = suggestionParts[0] || '';
        town = suggestionParts[2] || '';
        postalCode = suggestionParts[3] || '';
        country = "United Kingdom";
      }
    } else {
      if (address.road) {
        street = address.road;
        if (address.house_number) {
          street += ` ${address.house_number}`;
        }
      } else if (address.pedestrian) {
        street = address.pedestrian;
      }

      town = address.city || address.town || address.village || address.municipality || address.county || "";
      country = address.country || "";
      postalCode = address.postcode || "";
    }

    setAddressFields({
      street: street || "",
      town: town || "",
      country: country || "",
      postal_code: postalCode || "",
    });

    setAddressSearch("");
    setAddressSuggestions([]);
    setShowSuggestions(false);

    setStatus("Address selected and auto-filled!");
    setStatusType("success");
  };

  // Handle manual changes to address fields
  const handleAddressFieldChange = (field, value) => {
    setAddressFields((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Close address suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".postal-address-search")) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Close product dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".product-typeahead")) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Handle phone number input change
  const handlePhoneNumberChange = (value) => {
    if (!value.startsWith(phoneCountryCode)) {
      if (phoneCountryCode.startsWith(value)) {
        setPhoneNumber(phoneCountryCode);
      } else {
        setPhoneNumber(phoneCountryCode + value.replace(phoneCountryCode, ''));
      }
    } else {
      setPhoneNumber(value);
    }
  };

  // Validate phone number
  const validatePhoneNumber = () => {
    if (!phoneNumber.trim() || phoneNumber === phoneCountryCode) {
      setPhoneError("Phone number is required");
      return false;
    }

    const phoneWithoutFormatting = phoneNumber.replace(/[^\d\+]/g, "");
    const digitsOnly = phoneWithoutFormatting.replace(/\D/g, "");
    
    if (digitsOnly.length < 10) {
      setPhoneError("Phone number is too short");
      return false;
    }

    if (digitsOnly.length > 15) {
      setPhoneError("Phone number is too long");
      return false;
    }

    setPhoneError("");
    return true;
  };

  // Handle country code change
  const handleCountryCodeChange = (newCode) => {
    const oldCode = phoneCountryCode;
    setPhoneCountryCode(newCode);
    
    if (phoneNumber.startsWith(oldCode)) {
      setPhoneNumber(newCode + phoneNumber.slice(oldCode.length));
    } else {
      setPhoneNumber(newCode + phoneNumber.replace(/^\+\d+/, ''));
    }
  };

  // NEW: Check if customer exists before sending OTP
  async function checkCustomerExists(email) {
    setCheckingCustomer(true);
    try {
      const res = await fetch("/api/check-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, shop: shopDomain }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.exists) {
        // Customer exists, auto-fill the form
        setExistingCustomerData(data);
        
        // Auto-fill full name if available
        if (data.displayName) {
          const fullNameInput = document.querySelector('input[name="full_name"]');
          if (fullNameInput) fullNameInput.value = data.displayName;
        }
        
        // Auto-fill phone number if available
        if (data.phone) {
          // Extract country code and number if needed
          let phoneValue = data.phone;
          // Check if phone starts with +, if not, add the default country code
          if (!phoneValue.startsWith('+')) {
            phoneValue = phoneCountryCode + phoneValue;
          }
          setPhoneNumber(phoneValue);
        }
        
        // Auto-fill address if available
        if (data.address) {
          setAddressFields({
            street: data.address.street || "",
            town: data.address.town || "",
            country: data.address.country || "",
            postal_code: data.address.postal_code || "",
          });
        }
        
        // Show message and automatically mark email as verified
        setShowExistingCustomerMessage(true);
        setEmailVerified(true);
        setStatus("Existing customer found! Your details have been auto-filled.");
        setStatusType("success");
        
        // Hide the message after 5 seconds
        setTimeout(() => {
          setShowExistingCustomerMessage(false);
        }, 5000);
        
        return true;
      }
      
      return false;
    } catch (err) {
      console.error("Error checking customer:", err);
      return false;
    } finally {
      setCheckingCustomer(false);
    }
  }

  // Modified handleSendOtp function
  async function handleSendOtp(e) {
    e.preventDefault();
    
    if (!email.trim()) {
      setStatus("Please enter your email address.");
      setStatusType("error");
      return;
    }
    
    setStatusType(null);
    setStatus("Checking if you're an existing customer...");
    
    // First check if customer exists
    const customerExists = await checkCustomerExists(email);
    
    if (customerExists) {
      // Customer exists and form is auto-filled, no need to send OTP
      return;
    }
    
    // Customer doesn't exist, proceed with OTP sending
    setStatus("Sending OTP...");
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          shop: shopDomain,
        }),
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
    setExistingCustomerData(null);
    setShowExistingCustomerMessage(false);
    // Clear auto-filled fields
    setPhoneNumber(phoneCountryCode);
    setAddressFields({
      street: "",
      town: "",
      country: "",
      postal_code: "",
    });
    const fullNameInput = document.querySelector('input[name="full_name"]');
    if (fullNameInput) fullNameInput.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!emailVerified) {
      setStatus("Please verify your email first.");
      setStatusType("error");
      return;
    }

    if (!validatePhoneNumber()) {
      setStatus("Please enter a valid phone number.");
      setStatusType("error");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());

    delete body.phone;
    delete body.phone_country_code;

    body.phone = phoneNumber;
    body.email = email;
    body.otpToken = otpToken;
    Object.assign(body, addressFields);

    const selectedProduct = products.find((p) => p.id === body.product_id);
    if (selectedProduct) {
      body.product_title = selectedProduct.title;
    }

    setStatusType(null);
    setStatus("Submitting warranty...");
    try {
      const params = new URLSearchParams(window.location.search);
      const shopFromUrl = params.get("shop");
      const res = await fetch(`/api/submit-warranty?shop=${encodeURIComponent(shopFromUrl)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("Warranty submitted successfully.");
        setStatusType("success");
        setTimeout(() => {
          window.location.href = `/thankyou?shop=${encodeURIComponent(shopFromUrl)}`;
        }, 1000);
      } else {
        setStatus(data.error || "Failed to submit warranty.");
        setStatusType("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to submit warranty.");
      setStatusType("error");
    }
  }

  const countryOptions = countries.map((country) => ({
    value: country.code,
    label: country.country,
    isoCode: country.isoCode,
  }));

  const formatOptionLabel = ({ label, value, isoCode }) => {
    const flagUrl = findFlagUrlByIso2Code(isoCode);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <img src={flagUrl} alt={label} width="20" />
        <span><span className="ki0490400ki440ki">{label}</span>({value})</span>
      </div>
    );
  };

  return (
    <main className="warranty-page">
      <section className="warranty-section">
        <form className="warranty-form" onSubmit={handleSubmit}>
          <div className="email-verification-section fulllwwidth">
            {!emailVerified && (
              <>
                {!otpSent ? (
                  <>
                    <div className="warranty-field">
                      <label htmlFor="warranty-email">Email</label>
                      <input
                        id="warranty-email"
                        className="warranty-input"
                        type="email"
                        name="customer_email"
                        required
                        value={email}
                        placeholder="Email Address"
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={checkingCustomer}
                      />
                    </div>
                    <div className="warranty-actions otp-actions">
                      <button
                        className="warranty-button"
                        onClick={handleSendOtp}
                        disabled={!email.trim() || checkingCustomer}
                      >
                        {checkingCustomer ? "Checking..." : "Verify Email"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="warranty-field">
                      <label htmlFor="warranty-otp">Enter OTP</label>
                      <input
                        id="warranty-otp"
                        className="warranty-input"
                        type="text"
                        name="otp"
                        required
                        value={otp}
                        placeholder="Enter OTP"
                        onChange={(e) => setOtp(e.target.value)}
                      />
                    </div>
                    <div className="warranty-actions otp-actions">
                      <button
                        className="warranty-button secondary"
                        onClick={handleVerifyOtp}
                        disabled={!otp.trim()}
                      >
                        Verify OTP
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {emailVerified && (
              <div className="verification-success otp-actions">
                <p>Email verified successfully!</p>
                {showExistingCustomerMessage && existingCustomerData && (
                  <p style={{ color: "#4CAF50", marginTop: "10px", fontSize: "14px" }}>
                    ✓ Welcome back! Your details have been auto-filled.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleEditEmail}
                  className="edit-email-button"
                  style={{
                    marginLeft: "10px",
                    padding: "4px 12px",
                    fontSize: "12px",
                    background: "#f0f0f0",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Edit Email
                </button>
              </div>
            )}
          </div>

          <div className="warranty-field fulllwwidth">
            <label htmlFor="full_name">Full Name</label>
            <input
              id="full_name"
              className="warranty-input"
              type="text"
              name="full_name"
              placeholder="Full Name"
              required
              defaultValue={existingCustomerData?.displayName || ""}
            />
          </div>

          {/* Phone Number Section */}
          <div className="warranty-field fulllwwidth phone98008008">
            <div className="phone-input-container">
              <div className="country-code-selector">
                <Select
                  options={countryOptions}
                  value={countryOptions.find((c) => c.value === phoneCountryCode)}
                  onChange={(selected) => handleCountryCodeChange(selected.value)}
                  formatOptionLabel={formatOptionLabel}
                  isSearchable
                />
              </div>
              
              <input
                id="phone"
                className="warranty-input phone-number-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => handlePhoneNumberChange(e.target.value)}
                placeholder="+44 123 456 7890"
                required
                name="phone"
              />
            </div>
            
            {phoneError && (
              <div className="phone-error-message">
                {phoneError}
              </div>
            )}
          </div>

          {/* Address Search with Autocomplete */}
          <div className="postal-address-search">
            <div className="warranty-field">
              <label htmlFor="search_address">Search UK Address</label>
              <div className="address-autocomplete-container">
                <input
                  id="search_address"
                  className="warranty-input"
                  type="text"
                  value={addressSearch}
                  placeholder="Start typing address or postcode..."
                  onChange={(e) => setAddressSearch(e.target.value)}
                  name="search_address"
                />

                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="address-suggestions-dropdown">
                    {isSearching && (
                      <div className="suggestion-loading">Searching...</div>
                    )}

                    {addressSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="suggestion-item"
                        onClick={() => handleSelectAddress(suggestion)}
                      >
                        <div className="suggestion-main">
                          {suggestion.display_name
                            ? suggestion.display_name.split(",")[0]
                            : "Address"}
                        </div>
                        <div className="suggestion-details">
                          {suggestion.display_name
                            ? suggestion.display_name.split(",").slice(1).join(",").trim()
                            : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="warranty-actions otp-actions">
              <button
                className="warranty-button secondary"
                type="button"
                onClick={() => {
                  if (addressSearch.trim()) {
                    searchAddresses(addressSearch);
                  }
                }}
                disabled={!addressSearch.trim()}
              >
                {isSearching ? "Searching..." : "Find Address"}
              </button>
            </div>
          </div>

          {/* Address Fields - Auto-filled from search */}
          <div className="warranty-field">
            <label htmlFor="street">Street Address</label>
            <input
              id="street"
              className="warranty-input"
              type="text"
              name="street"
              required
              value={addressFields.street}
              placeholder="Street Address"
              onChange={(e) => handleAddressFieldChange("street", e.target.value)}
            />
          </div>

          <div className="warranty-field">
            <label htmlFor="town">Town / City</label>
            <input
              id="town"
              className="warranty-input"
              type="text"
              name="town"
              required
              value={addressFields.town}
              placeholder="Town / City"
              onChange={(e) => handleAddressFieldChange("town", e.target.value)}
            />
          </div>

          <div className="warranty-field">
            <label htmlFor="country">Country</label>
            <input
              id="country"
              className="warranty-input"
              type="text"
              name="country"
              required
              value={addressFields.country}
              placeholder="Country"
              onChange={(e) => handleAddressFieldChange("country", e.target.value)}
            />
          </div>

          <div className="warranty-field">
            <label htmlFor="postal_code">Postal Code</label>
            <input
              id="postal_code"
              className="warranty-input"
              type="text"
              name="postal_code"
              required
              value={addressFields.postal_code}
              placeholder="Postal Code"
              onChange={(e) =>
                handleAddressFieldChange("postal_code", e.target.value)
              }
            />
          </div>

          <div className="warranty-field labelupper908">
            <label htmlFor="purchase_source_select">Purchase Source</label>

            <div className="purchase-source-select-container">
              <Select
                inputId="purchase_source_select"
                classNamePrefix="purchase-source-select"
                options={purchaseSourceOptions}
                value={selectedPurchaseSource}
                onChange={(option) => setSelectedPurchaseSource(option)}
                isLoading={purchaseSourcesLoading}
                isClearable
                isSearchable
                placeholder={
                  purchaseSourcesLoading
                    ? "Loading purchase sources..."
                    : purchaseSourcesError
                    ? "Failed to load purchase sources"
                    : "Select purchase source..."
                }
              />
              <input
                type="hidden"
                name="purchase_source"
                value={selectedPurchaseSource?.value || ""}
                required
              />
            </div>

            {purchaseSourcesError && (
              <p className="warranty-status warranty-status--error">
                {purchaseSourcesError}
              </p>
            )}
          </div>

          <div className="warranty-field labelupper908">
            <label htmlFor="purchase_date">Purchase Date</label>
            <input
              id="purchase_date"
              className="warranty-input"
              type="date"
              name="purchase_date"
              required
            />
          </div>

          <div className="warranty-field">
            <label htmlFor="order_number">Order / Invoice Number</label>
            <input
              id="order_number"
              className="warranty-input"
              type="text"
              name="order_number"
              placeholder="Order / Invoice Number"
              required
            />
          </div>

          {/* Product typeahead field */}
          <div className="warranty-field product-typeahead">
            <label htmlFor="product_search">Product</label>

            <input
              id="product_search"
              className="warranty-input"
              type="text"
              placeholder={
                productsLoading
                  ? "Loading products..."
                  : productsError
                  ? "Failed to load products"
                  : "Type to search products..."
              }
              value={productSearchTerm}
              onChange={(e) => {
                setProductSearchTerm(e.target.value);
                setShowProductDropdown(true);
              }}
              onFocus={() => {
                if (!productsLoading && !productsError) {
                  setShowProductDropdown(true);
                }
              }}
              disabled={productsLoading || !!productsError}
              autoComplete="off"
            />

            <input
              type="hidden"
              name="product_id"
              value={selectedProductId}
              required
            />

            {showProductDropdown && !productsLoading && !productsError && (
              <div className="product-dropdown">
                {filteredProducts.length === 0 ? (
                  <div className="product-dropdown-item product-dropdown-empty">
                    No products found
                  </div>
                ) : (
                  filteredProducts.slice(0, 20).map((product) => (
                    <div
                      key={product.id}
                      className={
                        "product-dropdown-item" +
                        (product.id === selectedProductId ? " selected" : "")
                      }
                      onClick={() => {
                        setSelectedProductId(product.id);
                        setProductSearchTerm(product.title);
                        setShowProductDropdown(false);
                      }}
                    >
                      {product.title}
                    </div>
                  ))
                )}
              </div>
            )}

            {productsError && (
              <p className="warranty-status warranty-status--error">
                {productsError}
              </p>
            )}
          </div>

          <div className="warranty-field">
            <label htmlFor="serial_number">Product Serial Number</label>
            <input
              id="serial_number"
              className="warranty-input"
              type="text"
              name="serial_number"
              placeholder="Product Serial Number"
              required
            />
          </div>

          <p className="flexpara fulllwwidth">
            <input
              type="checkbox"
              name="termsformarketing"
              id="termsformarketing"
              defaultChecked
            />
            {" "}
            {marketingTextLoading && !marketingText
              ? "Loading..."
              : marketingText ||
                "Keep me updated with warranty status updates and follow-ups, which may include occasional offers and tech tips. You can unsubscribe anytime."}
          </p>

          <div className="warranty-actions">
            <button
              className="warranty-button"
              type="submit"
              disabled={!emailVerified}
            >
              Submit Warranty
            </button>
          </div>
        </form>

        {status && (
          <p
            className={
              "warranty-status " +
              (statusType === "error"
                ? "warranty-status--error"
                : statusType === "success"
                ? "warranty-status--success"
                : "")
            }
          >
            {status}
          </p>
        )}
      </section>
    </main>
  );
}