import Stripe from "stripe";

export function createStripe(env: Pick<Env, "STRIPE_SECRET_KEY">): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 10_000,
  });
}

export async function constructStripeEvent(
  stripe: Stripe,
  rawBody: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  return stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    secret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
