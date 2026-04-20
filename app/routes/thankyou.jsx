import "../styles/warranty.css"; 

export default function ThankYouPage() {

    function handlethanku() {
      const params = new URLSearchParams(window.location.search);
      const shopFromUrl = params.get("shop");
      if (shopFromUrl) {
          window.location.href = `/warranty?shop=${encodeURIComponent(shopFromUrl)}`;
      }
    }
    return (   
        <section className="thankyou-section">
            <div className="position-centered-thankyou">
            <h1>Thank You!</h1>
            <p>Your warranty registration has been successfully submitted.</p>
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