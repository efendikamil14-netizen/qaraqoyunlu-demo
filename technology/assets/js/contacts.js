/*
 * Qaraqoyunlu — contact details of the three sites.
 * defaults: the values written in each site's index.html. If you change a contact in the
 * HTML by hand, change it here too, or /admin/ stops finding it on the page.
 * On Cloudflare, a Pages Function (see functions/) adds QQ_CONTACTS.saved; core.js applies it.
 */
window.QQ_CONTACTS = {
  defaults: {
    group: {
      phones: ['+994102520373', '+994552160021'],
      whatsapp: '+994552160021',
      email: 'qaraqoyunlugroup@gmail.com',
      instagram: 'https://www.instagram.com/qaraqoyunlugroup/'
    },
    technology: {
      phones: ['+994102520373', '+994552160021'],
      whatsapp: '+994552160021',
      email: 'qaraqoyunlutechnology@gmail.com',
      instagram: 'https://www.instagram.com/qaraqoyunlutechnology/'
    },
    consulting: {
      phones: ['+994102568787', '+994102568788', '+994125140411'],
      whatsapp: '+994102568787',
      email: 'qaraqoyunluconsulting@gmail.com',
      instagram: 'https://www.instagram.com/qaraqoyunluconsulting/',
      tiktok: 'https://www.tiktok.com/@qaraqoyunluconsulting'
    }
  }
};
