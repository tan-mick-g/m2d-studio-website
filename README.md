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

Only emails in `public.admin_users` can save site content.

## Vercel

This is a static site. Import the GitHub repository into Vercel and deploy with:

- Framework preset: Other
- Build command: leave empty
- Output directory: leave empty
