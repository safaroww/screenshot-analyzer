# 🚀 Deploy Support & Privacy Pages to GitHub Pages

## Quick Commands (5 Minutes)

```bash
# Navigate to your project
cd /Users/lala/Desktop/dev_safaroww

# Copy both HTML files to repository root
cp analyzer/mobile/privacy-policy.html .
cp analyzer/mobile/support.html .

# Add and commit
git add privacy-policy.html support.html
git commit -m "Add support and privacy policy pages"
git push origin main
```

## Enable GitHub Pages

1. Go to: https://github.com/safaroww/screenshot-analyzer/settings/pages
2. Under "Source", select **main** branch
3. Select **/ (root)** folder
4. Click **Save**
5. Wait 2-3 minutes for deployment

## Your URLs Will Be:

**Privacy Policy:**
```
https://safaroww.github.io/screenshot-analyzer/privacy-policy.html
```

**Support Page:**
```
https://safaroww.github.io/screenshot-analyzer/support.html
```

---

## 📝 What to Put in App Store Connect

### Support URL:
```
https://safaroww.github.io/screenshot-analyzer/support.html
```

### Privacy Policy URL:
```
https://safaroww.github.io/screenshot-analyzer/privacy-policy.html
```

---

## ✅ Verify It Works

After GitHub Pages deploys (2-3 minutes):

1. Visit: https://safaroww.github.io/screenshot-analyzer/support.html
2. Check that all links work
3. Test the contact form or email link
4. Verify privacy policy link works

---

## 📧 Optional: Set Up Contact Form (Formspree)

If you want the contact form to actually submit (instead of opening email):

1. Go to: https://formspree.io (free)
2. Sign up with your email
3. Create a new form
4. Copy your form endpoint (looks like: `https://formspree.io/f/xyzabc123`)
5. In `support.html`, replace `YOUR_FORM_ID` with your actual form ID:
   ```html
   <form class="contact-form" action="https://formspree.io/f/xyzabc123" method="POST">
   ```

Currently it falls back to opening your email client, which works fine!

---

## 🎨 What's Included

### Support Page Features:
- ✅ Matches your app's dark theme with gold accents
- ✅ Links to Privacy Policy
- ✅ Contact form (opens email client by default)
- ✅ Complete FAQ section (10 questions)
- ✅ Mobile responsive
- ✅ Beautiful hover effects
- ✅ Direct email link

### Privacy Policy Features:
- ✅ Professional design
- ✅ Links back to Support page
- ✅ GDPR & CCPA compliant
- ✅ Mobile responsive

---

## 🚀 Ready!

Once deployed, use these URLs in App Store Connect and you're all set! 🎉
