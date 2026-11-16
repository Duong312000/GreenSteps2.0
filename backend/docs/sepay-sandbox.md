# SePay Sandbox

GreenSteps already supports SePay bank transfer checkout for service and tour bookings. The browser sends the checkout form to SePay; the backend creates and signs it, and only the IPN endpoint can mark a booking paid.

## Configure credentials

1. In SePay, enable the Payment Gateway and start with Sandbox. Save the Sandbox Merchant ID and Merchant Secret Key when they are shown; the Merchant Secret Key is displayed once.
2. In the backend `.env`, set `SEPAY_ENV=sandbox`, `SEPAY_MERCHANT_ID`, and `SEPAY_MERCHANT_SECRET` using those Sandbox credentials.
3. In SePay's Payment Gateway → Configuration → IPN, choose `SECRET_KEY` authentication and set a separate IPN secret. Put that same value in `SEPAY_IPN_SECRET`.
4. Set the IPN URL in SePay to `https://<your-public-domain>/api/v1/payments/sepay/ipn`. For local development, expose the backend through an HTTPS tunnel and use its public URL. SePay cannot call `localhost`.
5. Restart the backend, then choose **SePay — QR ngân hàng** in the booking form. SePay's return URL goes to `/booking/confirm`; the page reads the booking status from the backend, while IPN is the source of payment confirmation.

Keep both Merchant credentials and the IPN secret in backend environment variables. Never put them in Angular configuration or commit them. Sandbox credentials work only with the Sandbox environment; switch to Production only after testing, and then replace the Merchant credentials, `SEPAY_ENV`, IPN configuration, and public callback URLs together.

## Environment variables

```dotenv
SEPAY_ENV=sandbox
SEPAY_MERCHANT_ID=
SEPAY_MERCHANT_SECRET=
SEPAY_IPN_SECRET=
```

The API also exposes `GET /api/v1/payments/sepay/config` to report whether the required backend settings are present. It never returns credential values.
