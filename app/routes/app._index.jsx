import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Loader: simply authenticate the embedded admin request.
// This page is documentation only — no data fetching required.
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

export default function AppDocumentationPage() {
  return (
    <s-page heading="Warranty Activation Suite — Documentation">
      {/* ---------------------------------------------------------------- */}
      {/* 1. APP OVERVIEW                                                  */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="What this app does">
        <s-paragraph>
          The <s-text type="strong">Warranty Activation Suite</s-text> lets
          your customers register the products they have bought from you and
          later submit warranty claims against those registrations — all from
          a single storefront experience.
        </s-paragraph>

        <s-paragraph>
          As a merchant, you use the embedded admin pages to configure how the
          public forms behave, review incoming registrations, approve or
          reject warranty claims, and send branded email notifications at each
          step.
        </s-paragraph>

        <s-stack direction="block" gap="small">
          <s-text type="strong">Core features</s-text>
          <s-text>
            • <s-text type="strong">Warranty registration</s-text> — Customers
            submit purchase details (product, source, invoice, serial number)
            to activate their warranty.
          </s-text>
          <s-text>
            • <s-text type="strong">Claim submission</s-text> — Registered
            customers can later raise a warranty claim with attachments.
          </s-text>
          <s-text>
            • <s-text type="strong">Admin review</s-text> — You approve,
            reject, or mark registrations and claims as “In Process”.
          </s-text>
          <s-text>
            • <s-text type="strong">Customer notifications</s-text> —
            Transactional emails go out automatically through Brevo using
            templates you control.
          </s-text>
          <s-text>
            • <s-text type="strong">Media uploads</s-text> — Claim evidence
            (photos / videos / invoices) is stored on Cloudinary.
          </s-text>
        </s-stack>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. NAVIGATION OVERVIEW                                           */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="App pages at a glance">
        <s-stack direction="block" gap="small">
          <s-text>
            <s-text type="strong">Warranty Listing</s-text> — All customers
            who have registered a product. Edit the warranty start date, end
            date, and status (Pending / Approved / Rejected / In Process).
          </s-text>
          <s-text>
            <s-text type="strong">Claim Warranties</s-text> — All warranty
            claims submitted by customers. Review attachments and update the
            claim status.
          </s-text>
          <s-text>
            <s-text type="strong">Warranty Configuration</s-text> — Every
            setting that controls how the public forms and email notifications
            behave. This is the page documented below.
          </s-text>
          <s-text>
            <s-text type="strong">Billing</s-text> — Manage your subscription
            to the app.
          </s-text>
        </s-stack>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 3. SETUP CHECKLIST                                               */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="Setup checklist (do this first)">
        <s-paragraph>
          Before you make the warranty forms live on your storefront, complete
          these five steps inside{" "}
          <s-text type="strong">Warranty Configuration</s-text>:
        </s-paragraph>

        <s-stack direction="block" gap="small">
          <s-text>
            1. Add at least one <s-text type="strong">Purchase source</s-text>{" "}
            (registration form tab).
          </s-text>
          <s-text>
            2. Review the <s-text type="strong">Marketing consent text</s-text>{" "}
            on both the registration and claim forms.
          </s-text>
          <s-text>
            3. Enter your <s-text type="strong">Brevo API key</s-text> and
            verified sender email so notifications can be delivered.
          </s-text>
          <s-text>
            4. Customize the four{" "}
            <s-text type="strong">Email templates</s-text> (Warranty Approved,
            Warranty Disapproved, Claim Approved, Claim Rejected).
          </s-text>
          <s-text>
            5. Enter your <s-text type="strong">Cloudinary</s-text>{" "}
            credentials so claim attachments can be uploaded.
          </s-text>
        </s-stack>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. TAB 1 — WARRANTY REGISTRATION FORM                             */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="Tab 1 — Warranty registration form">
        <s-paragraph>
          Controls what appears on the public{" "}
          <s-text type="strong">warranty activation</s-text> form, which is
          the form your customers fill in to register a product they have
          purchased.
        </s-paragraph>

        {/* 4a. Purchase sources */}
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>Purchase source options</s-heading>

            <s-paragraph>
              The <s-text type="strong">Purchase source</s-text> dropdown on
              the public form lets the customer tell you{" "}
              <s-text type="emphasis">where</s-text> they bought the product
              from. The values you add here are exactly the options the
              customer will see.
            </s-paragraph>

            <s-text type="strong">How to configure</s-text>
            <s-text>
              • Type a label into the{" "}
              <s-text type="strong">New purchase source</s-text> field — for
              example <s-text type="emphasis">Amazon</s-text>,{" "}
              <s-text type="emphasis">eBay</s-text>,{" "}
              <s-text type="emphasis">Mobitel Website</s-text>, or{" "}
              <s-text type="emphasis">Physical Store</s-text>.
            </s-text>
            <s-text>
              • Click <s-text type="strong">Add purchase source</s-text>. It
              appears immediately in the “Existing purchase sources” list.
            </s-text>
            <s-text>
              • Remove a source with the{" "}
              <s-text type="strong">Remove</s-text> button. Existing customer
              registrations keep the original source value — only future
              submissions are affected.
            </s-text>

            <s-text type="strong">Tips</s-text>
            <s-text>
              • Use customer-friendly names — these are shown directly to
              shoppers.
            </s-text>
            <s-text>
              • Add at least one source before you publish the form, otherwise
              the dropdown will be empty.
            </s-text>
            <s-text>
              • Keep the list short (5–10 entries) so customers can find their
              option quickly.
            </s-text>
          </s-stack>
        </s-box>

        {/* 4b. Marketing consent text (registration) */}
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>Marketing consent text</s-heading>

            <s-paragraph>
              This is the sentence shown next to the consent{" "}
              <s-text type="strong">checkbox</s-text> at the bottom of the
              registration form. When the customer ticks the checkbox, you
              have a record of their opt-in.
            </s-paragraph>

            <s-text type="strong">How to configure</s-text>
            <s-text>
              • Edit the multi-line text area and click{" "}
              <s-text type="strong">Save marketing text</s-text>.
            </s-text>
            <s-text>
              • Default value: <s-text type="emphasis">“Keep me updated
              with warranty status updates and follow-ups, which may include
              occasional offers and tech tips. You can unsubscribe
              anytime.”</s-text>
            </s-text>

            <s-text type="strong">Tips</s-text>
            <s-text>
              • Keep the wording compliant with your local privacy / marketing
              laws (GDPR, CAN-SPAM, etc.).
            </s-text>
            <s-text>
              • Make clear that ticking the checkbox is optional and how the
              customer can unsubscribe.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 5. TAB 2 — CLAIM WARRANTY FORM                                   */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="Tab 2 — Claim warranty form">
        <s-paragraph>
          The claim form is what registered customers use later to submit a{" "}
          <s-text type="strong">warranty claim</s-text> against one of their
          registered products.
        </s-paragraph>

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>Claim form marketing consent text</s-heading>

            <s-paragraph>
              Same idea as the registration form: this text appears next to
              the consent checkbox on the claim form, where the customer
              agrees to receive updates about the progress of their claim.
            </s-paragraph>

            <s-text type="strong">How to configure</s-text>
            <s-text>
              • Edit the text area and click{" "}
              <s-text type="strong">Save claim marketing text</s-text>.
            </s-text>
            <s-text>
              • Default value:{" "}
              <s-text type="emphasis">
                “Keep me updated on my claim status via email”
              </s-text>
              .
            </s-text>

            <s-text type="strong">Tips</s-text>
            <s-text>
              • Keep this text focused on{" "}
              <s-text type="strong">claim status updates</s-text> rather than
              general marketing — that maps better to the customer’s
              expectation when filing a claim.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 6. TAB 3 — EMAIL CONFIGURATIONS                                  */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="Tab 3 — Email configurations (Brevo)">
        <s-paragraph>
          The app sends transactional emails (OTP verification, warranty
          approved / rejected, claim approved / rejected) through{" "}
          <s-text type="strong">Brevo</s-text> (formerly Sendinblue). Without
          these credentials, no emails will be delivered.
        </s-paragraph>

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>How to get your Brevo credentials</s-heading>

            <s-text>
              1. Sign in at{" "}
              <s-text type="strong">app.brevo.com</s-text> (or create a free
              account).
            </s-text>
            <s-text>
              2. Open <s-text type="strong">SMTP &amp; API → API Keys</s-text>{" "}
              and click <s-text type="strong">Generate a new API key</s-text>.
              Copy the value — Brevo only shows it once.
            </s-text>
            <s-text>
              3. Under <s-text type="strong">Senders &amp; IP → Senders</s-text>,
              add the email address you want emails to come from and complete
              the verification email Brevo sends you.
            </s-text>
          </s-stack>
        </s-box>

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>Fields on this tab</s-heading>

            <s-text>
              • <s-text type="strong">Brevo API key</s-text> — Paste the key
              you copied above. It is stored encrypted-at-rest and is masked
              in the form (password field).
            </s-text>
            <s-text>
              • <s-text type="strong">Brevo sender email</s-text> — The
              verified email address that will appear as the “From” on every
              outgoing message (for example{" "}
              <s-text type="emphasis">no-reply@yourstore.com</s-text>).
            </s-text>

            <s-text type="strong">Tips</s-text>
            <s-text>
              • Use a domain you own and have authenticated in Brevo
              (SPF/DKIM). Unauthenticated senders often land in spam.
            </s-text>
            <s-text>
              • Re-issue the key in Brevo and update it here if it is ever
              exposed in logs or screenshots.
            </s-text>
            <s-text>
              • Both fields are required — the form will not save until both
              are filled and the sender email contains an{" "}
              <s-text type="emphasis">@</s-text> sign.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 7. TAB 4 — EMAIL TEMPLATES                                       */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="Tab 4 — Email templates">
        <s-paragraph>
          Four templates control every customer-facing email the app sends.
          Each template has an <s-text type="strong">HTML body</s-text>, a{" "}
          <s-text type="strong">plain-text fallback</s-text>, and a{" "}
          <s-text type="strong">subject line</s-text>. Use{" "}
          <s-text type="strong">{"{{variables}}"}</s-text> to insert
          per-customer data.
        </s-paragraph>

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>The four templates</s-heading>

            <s-text>
              • <s-text type="strong">Warranty Approved</s-text> — Sent when
              you change a registration’s status to{" "}
              <s-text type="emphasis">Approved</s-text>. Variables:{" "}
              <s-text type="emphasis">
                customerName, productName, orderNumber, serialNumber,
                startDate, endDate, shopDomain
              </s-text>
              .
            </s-text>
            <s-text>
              • <s-text type="strong">Warranty Disapproved</s-text> — Sent
              when you change a registration’s status to{" "}
              <s-text type="emphasis">Rejected</s-text>. Variables:{" "}
              <s-text type="emphasis">
                customerName, productName, orderNumber, serialNumber,
                shopDomain
              </s-text>
              .
            </s-text>
            <s-text>
              • <s-text type="strong">Claim Approved</s-text> — Sent when a
              warranty claim is approved. Variables:{" "}
              <s-text type="emphasis">
                customerName, claimId, claimType, claimDescription, shopDomain
              </s-text>
              .
            </s-text>
            <s-text>
              • <s-text type="strong">Claim Rejected</s-text> — Sent when a
              warranty claim is rejected. Variables:{" "}
              <s-text type="emphasis">
                customerName, claimId, claimType, claimDescription, shopDomain
              </s-text>
              .
            </s-text>
          </s-stack>
        </s-box>

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>How to edit a template</s-heading>

            <s-text>
              1. Pick a template using the buttons at the top — the editor
              opens below.
            </s-text>
            <s-text>
              2. Edit the <s-text type="strong">Email Subject</s-text> line.
              Variables work here too — e.g.{" "}
              <s-text type="emphasis">
                “Your {"{{productName}}"} warranty has been approved”
              </s-text>
              .
            </s-text>
            <s-text>
              3. Edit the <s-text type="strong">HTML Content</s-text>. Use the{" "}
              <s-text type="strong">Preview</s-text> toggle to see how the
              rendered email will look.
            </s-text>
            <s-text>
              4. Provide a <s-text type="strong">Plain Text Content</s-text>{" "}
              version for email clients that don’t render HTML. Keep the same
              variable placeholders.
            </s-text>
            <s-text>
              5. Click <s-text type="strong">Save Template</s-text>.{" "}
              <s-text type="strong">Reset to Default</s-text> restores the
              built-in template if you want to start over.
            </s-text>

            <s-text type="strong">Tips</s-text>
            <s-text>
              • Wrap variables in double braces:{" "}
              <s-text type="emphasis">{"{{customerName}}"}</s-text>. Unknown
              variable names are left blank in the sent email.
            </s-text>
            <s-text>
              • Keep the HTML simple — inline CSS, table layouts, and absolute
              image URLs render most reliably across mail clients.
            </s-text>
            <s-text>
              • Always send a test from Brevo after editing to confirm the
              layout looks right.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 8. TAB 5 — CLOUDFLARE / CLOUDINARY CONFIGURATION                 */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="Tab 5 — Cloudflare / Cloudinary configuration">
        <s-paragraph>
          When a customer files a claim they can attach photos, videos, or
          invoice scans. Those files are uploaded to{" "}
          <s-text type="strong">Cloudinary</s-text> and the resulting URLs are
          saved on the claim record so you can review them from the admin.
          Without these credentials, file uploads on the claim form will fail.
        </s-paragraph>

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>How to get your Cloudinary credentials</s-heading>

            <s-text>
              1. Sign in at <s-text type="strong">cloudinary.com</s-text> (the
              free tier is enough to start).
            </s-text>
            <s-text>
              2. Open the <s-text type="strong">Dashboard</s-text>. The top of
              the page shows your <s-text type="strong">Cloud name</s-text>,{" "}
              <s-text type="strong">API Key</s-text>, and{" "}
              <s-text type="strong">API Secret</s-text>.
            </s-text>
            <s-text>
              3. Copy all three values — you will paste them into the fields
              on this tab.
            </s-text>
          </s-stack>
        </s-box>

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="small">
            <s-heading>Fields on this tab</s-heading>

            <s-text>
              • <s-text type="strong">Cloud name</s-text> — Your Cloudinary
              account identifier. It is the subdomain used in your media URLs
              (for example{" "}
              <s-text type="emphasis">res.cloudinary.com/mystore</s-text>{" "}
              means the cloud name is{" "}
              <s-text type="emphasis">mystore</s-text>).
            </s-text>
            <s-text>
              • <s-text type="strong">Cloudinary key</s-text> — The public API
              key from your dashboard. Used to sign upload requests.
            </s-text>
            <s-text>
              • <s-text type="strong">Cloudinary secret</s-text> — The private
              API secret. Stored encrypted-at-rest and masked in the form
              (password field). Treat it like a password — never share or
              commit it.
            </s-text>

            <s-text type="strong">Tips</s-text>
            <s-text>
              • All three fields are required. Saving will fail if any are
              blank.
            </s-text>
            <s-text>
              • If a secret leaks, regenerate it in the Cloudinary dashboard
              and update it here right away.
            </s-text>
            <s-text>
              • For production, create a separate Cloudinary preset that
              limits the file types and maximum file size customers can
              upload.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 9. STATUS WORKFLOW                                               */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="Status workflow (for your reference)">
        <s-paragraph>
          Both warranty registrations and warranty claims move through the
          same four statuses. Changing a status from the admin pages triggers
          the matching customer email automatically (if Brevo is configured).
        </s-paragraph>

        <s-stack direction="block" gap="small">
          <s-text>
            • <s-text type="strong">Pending</s-text> — Default state right
            after submission. No email is sent.
          </s-text>
          <s-text>
            • <s-text type="strong">In Process</s-text> — You are reviewing
            the record. No email is sent.
          </s-text>
          <s-text>
            • <s-text type="strong">Approved</s-text> — Sends the{" "}
            <s-text type="emphasis">Warranty Approved</s-text> or{" "}
            <s-text type="emphasis">Claim Approved</s-text> template.
          </s-text>
          <s-text>
            • <s-text type="strong">Rejected</s-text> — Sends the{" "}
            <s-text type="emphasis">Warranty Disapproved</s-text> or{" "}
            <s-text type="emphasis">Claim Rejected</s-text> template.
          </s-text>
        </s-stack>
      </s-section>

      {/* ---------------------------------------------------------------- */}
      {/* 10. TROUBLESHOOTING                                              */}
      {/* ---------------------------------------------------------------- */}
      <s-section heading="Troubleshooting">
        <s-stack direction="block" gap="small">
          <s-text>
            <s-text type="strong">Customers don’t receive emails.</s-text>{" "}
            Check that the Brevo API key is current, the sender email is
            verified inside Brevo, and that the email isn’t in the customer’s
            spam folder. Try sending a test from Brevo directly.
          </s-text>
          <s-text>
            <s-text type="strong">
              The purchase source dropdown is empty on the storefront.
            </s-text>{" "}
            You haven’t added any purchase sources yet — add at least one on
            the <s-text type="emphasis">Warranty registration form</s-text>{" "}
            tab.
          </s-text>
          <s-text>
            <s-text type="strong">Claim attachments fail to upload.</s-text>{" "}
            Re-check the three Cloudinary fields. The key/secret pair must
            belong to the same cloud name. If you rotated the secret, paste
            the new one here.
          </s-text>
          <s-text>
            <s-text type="strong">
              An email shows literal <s-text type="emphasis">{"{{customerName}}"}</s-text> instead of the customer’s name.
            </s-text>{" "}
            The variable name is misspelled or not supported for that
            template. Double-check the variable list shown in the editor for
            the template you are editing.
          </s-text>
          <s-text>
            <s-text type="strong">
              I changed a status but the customer didn’t get an email.
            </s-text>{" "}
            Emails are sent only for{" "}
            <s-text type="emphasis">Approved</s-text> and{" "}
            <s-text type="emphasis">Rejected</s-text> transitions — not for{" "}
            <s-text type="emphasis">Pending</s-text> or{" "}
            <s-text type="emphasis">In Process</s-text>.
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
