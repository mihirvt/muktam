# LinkedIn Conversion Integration

## What is already prepared in the form payload

The landing page forms now send these LinkedIn-ready fields along with the email webhook payload:

- `event_id`
- `deduplication_key`
- `conversion_happened_at`
- `external_id`
- `li_fat_id`
- `utm_*`
- normalized `email`, `phone`, and `website`
- `linkedin.user.email_sha256`

These are emitted from:

- `/Users/albatross/Downloads/Muktam Landing page/index.html`
- `/Users/albatross/Downloads/Muktam Landing page/contact.html`
- `/Users/albatross/Downloads/Muktam Landing page/eCom/index.html`

## LinkedIn architecture

- Visitor and page activity can be sent from the browser with the LinkedIn Insight Tag.
- Lead conversion events that use the LinkedIn Conversions API must be sent from a trusted server with the bearer token.
- Do not place the LinkedIn access token in frontend HTML or JavaScript.

## Required LinkedIn setup still needed

- LinkedIn Insight Tag partner ID for browser-side visitor tracking
- Conversion rule URN for the `LEAD` event you want to post to
- A trusted server endpoint that receives the form payload and forwards the LinkedIn conversion event

## Recommended deduplication approach

- Use one browser event for visitor/page tracking through the Insight Tag
- Use one server event for the lead conversion through Conversions API
- Reuse the same `event_id` for both if you are tracking the same conversion in browser and server flows
- Keep `conversion_happened_at` fixed for that submission

## Recommended server payload mapping

- `conversion`: your LinkedIn conversion rule URN
- `conversionHappenedAt`: use the form `conversion_happened_at`
- `eventId`: use the form `event_id`
- `user.userIds`: send available identifiers such as `LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID`, hashed email, and phone if supported by your conversion rule
- `userInfo`: include lead metadata such as name, company, website, category, UTM data, and source page for your own logging

## Security note

The access token shared in chat should be treated as exposed. Rotate it before production use.
