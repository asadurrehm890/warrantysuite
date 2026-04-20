import "../styles/warranty.css"; 

export default function ClaimThankYouPage() {

    function handlethanku() {
         const params = new URLSearchParams(window.location.search);
      const shopFromUrl = params.get("shop");
      if (shopFromUrl) {
        window.location.href = `/warranty-claims?shop=${encodeURIComponent(shopFromUrl)}`;
      }
    }
    return (   
        <section className="thankyou-section">
            <div className="position-centered-thankyou">
            <h1>Thank You!</h1>
            <p>Your warranty claim has been successfully submitted.</p>
             <div className="warranty-actions">
            <button
              className="warranty-button"
              onClick={handlethanku}
            >
              Back
            </button>

            
          </div>
            </div>
        </section>
    );
}