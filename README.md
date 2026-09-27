# Made To Dance Website

Premium static landing page with a Supabase-backed admin content editor.

## Local Preview

```sh
python3 -m http.server 4174
```

Public site:

```txt
http://127.0.0.1:4174/
```

Admin editor:

```txt
http://127.0.0.1:4174/admin.html
```

## Supabase Setup

1. Run `supabase-setup.sql` in the Supabase SQL Editor.
2. Add each admin email to `public.admin_users`.
3. Create matching users in Supabase Auth.
4. Confirm `supabase-config.js` has the Project URL and anon public key.

Only emails in `public.admin_users` can save site content or upload media.

The setup SQL also creates a public Supabase Storage bucket named `site-media`.
The admin page can upload images and videos there, then automatically save the public file URL into the homepage content.

The contact form saves inquiries to `public.contact_submissions`. Visitors can submit messages without signing in, but only listed admins can read or manage those submissions in Supabase.

To also send contact form emails through Resend, add these Vercel environment variables:

- `RESEND_API_KEY`: your Resend API key.
- `CONTACT_FROM_EMAIL`: the verified sender, for example `Made To Dance Website <website@madetodance.ph>`.
- `CONTACT_TO_EMAIL`: fallback recipient, for example `marketing@madetodance.ph`.

The public contact form calls `/api/contact`, saves the inquiry to Supabase, then sends the email through Resend. The admin-editable recipient email is accepted only for `@madetodance.ph` addresses.

### Invite Links

In Supabase Dashboard > Authentication > URL Configuration:

- Set Site URL to `https://m2d-studio-website.vercel.app/admin.html`.
- Add Redirect URLs for every admin URL you will use:
  - `https://m2d-studio-website.vercel.app/admin.html`
  - `https://m2d-studio-website.vercel.app/**`
  - `http://127.0.0.1:4174/admin.html`
  - `http://127.0.0.1:4174/**`

When inviting users from Supabase Auth, the invite link should send them to `admin.html`, where they can create their password.

## Vercel

This is a static site. Import the GitHub repository into Vercel and deploy with:

- Framework preset: Other
- Build command: leave empty
- Output directory: leave empty

## Studio Screen

`/screen` (or `/screen.html`) is the standalone TV playlist. It has no website navigation and asks search engines not to index it. The URL is public, so use public-facing media only.

In **Admin → Studio Screen**:

1. Upload images/videos or add direct media URLs. Rate cards are uploaded images.
2. Drag the move handle, use the up/down buttons, or enter a position number and press Enter to order slides. Moving a slide inserts it into that slot and shifts the intervening slides. Duplicate a slide to repeat it later in the loop; disable slides to keep them out of playback.
3. Choose **Fit** to preserve the whole image/video or **Fill** to crop. Optional landscape media replaces the main file on wider screens. Fit images can use a blurred background; videos use the display background image or color.
4. Adjust timing, transitions, background color, and video sound in **Display Settings**. Videos play to completion; sound is muted by default.
5. Use **Preview** for unsaved portrait/landscape playback, then **Save Changes** to publish with the existing website content. Switching away from Preview stops preview playback.

The page uses the existing `site_content` row and `site-media` bucket; no database migration is required. Screen artwork is uploaded at its original resolution, preserving text and portrait images. Prefer appropriately sized images and compressed browser-compatible MP4 videos for the TV's memory and bandwidth.

### AbleSign setup

Add the deployed site's `/screen` URL as a Website in AbleSign. Set the website's display duration long enough to cover the playlist. The page checks for updates every 60 seconds and applies changes between slides. If browser storage is available, reloads resume with the next slide after the last successfully displayed item.

A failed load is skipped after 20 seconds; a video with no playback progress is skipped after approximately 30 seconds. Failed media is retried after a cooldown. An empty or fully unavailable playlist shows a branded fallback. Webpage playback requires internet; offline media caching is not implemented. If the TV browser blocks autoplay with sound, the video retries muted.

Verify the deployed page on the actual AbleSign device, particularly sound, video codecs, orientation, and reload timing. Local previews cannot guarantee the TV's browser behavior.

### Local verification

With the preview server above, open `http://127.0.0.1:4174/screen.html`. The clean `/screen` path uses the Vercel route and is not resolved by Python's basic static server.

Run playback regression checks (Node.js 18+):

```sh
node --test tests/screen.test.cjs
```

The tests cover load timing, broken/stalled media, muted autoplay fallback, orientation variants, preview message isolation, published updates at slide boundaries, and reload resume behavior. They do not write to Supabase.

Studio Screen display settings also include an uploaded background image and an editable loading/empty screen (image, layout, message, and text color). The background image covers the screen behind fitted media; a slide’s blurred background overrides it. Use **Preview Loading Screen** to check its design without changing the playlist. Repeat visits use the last published appearance from browser storage while current settings load; first visits show an empty background until settings arrive. Clearing the image or message hides it.

**Show Loading Screen** hides or enables the saved loading design (on by default). **Show between each image / video** inserts that design after each completed item, including at the end of a loop (off by default). Its duration defaults to 3 seconds, adjustable from 1–60 seconds; it remains visible if the next media needs longer to load. Turning off the loading screen also suppresses between-media playback without erasing either preference or artwork.

The screen also supports interactive browsing through translucent **Videos**, **Packages**, and **Schedule** buttons. The mouse cursor stays visible. In **Admin → Studio Screen → Navigation**, set separate public video titles and a browsing inactivity timeout (15–600 seconds, default 60). Blank video titles use numbered labels. Upload Packages/rate cards and Schedule images directly in **Navigation**, independently of the playlist. Each section supports multiple images, titles, URLs, replacements, optional landscape URLs, and visibility controls. Existing playlist images tagged as packages or schedules migrate into these separate collections and stop playing in the automatic loop. Classes retains its own independent webpage/image settings. Only enabled media with a URL appears in galleries.

Browsing pauses automatic playback. Images open fitted to the screen without cropping. A selected video plays once, then the playlist continues with the item after the interrupted slide. **Back to Playlist**, Escape, or the browsing inactivity timeout also resumes playback. The inactivity timer does not interrupt a selected video; existing loading and stalled-video recovery still apply. Published updates received during browsing apply when the playlist resumes.

The **Rotate** button turns the entire screen 90° clockwise per click (0°, 90°, 180°, 270°). It remembers the orientation in that browser on that device, swaps the layout dimensions, and selects media variants using the rotated layout. Admin preview rotation stays temporary. This rotates the webpage within the TV app; it does not change the TV’s system orientation.

**Classes** opens either an embedded webpage or a fitted image, configured under **Studio Screen → Navigation → Classes Button**. Switching modes preserves both sources; images can be uploaded or linked. Classes content stays inside the rotated screen. An empty source shows a coming-soon message. Websites must permit iframe embedding; the embedded page cannot navigate the entire display or open popups. The normal return timer applies, but interaction inside an external webpage cannot reset it. Increase the timeout if visitors need more time.

Video cards in the screen gallery and admin playlist capture a real frame near one second into the clip (halfway through shorter clips). Preview decoding is lazy and stops after capture. Unsupported or unreachable videos show “Preview unavailable”; the gallery card still allows playback.
