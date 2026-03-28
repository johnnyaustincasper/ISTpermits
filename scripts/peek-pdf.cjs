const Imap = require('imap');
const { simpleParser } = require('mailparser');
const pdfParse = require('pdf-parse');

const imap = new Imap({
  user: 'Ivebeencelested@gmail.com',
  password: 'vzdldgexansthuxb',
  host: 'imap.gmail.com', port: 993, tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

imap.once('ready', () => {
  imap.openBox('INBOX', true, (err) => {
    imap.search(['ALL'], (err, results) => {
      if (!results?.length) { console.log('no emails'); imap.end(); return; }
      // grab last 5
      const toFetch = results.slice(-5);
      const f = imap.fetch(toFetch, { bodies: '' });
      f.on('message', msg => {
        let buf = '';
        msg.on('body', stream => stream.on('data', d => buf += d));
        msg.once('end', async () => {
          const parsed = await simpleParser(buf);
          const subject = parsed.subject || '';
          if (!subject.toLowerCase().includes('now') && !subject.toLowerCase().includes('job')) return;
          for (const att of (parsed.attachments || [])) {
            if (att.filename?.toLowerCase().includes('job') && att.filename?.toLowerCase().endsWith('.pdf')) {
              const data = await pdfParse(att.content);
              console.log('\n=== PDF:', att.filename, '===');
              console.log(data.text.substring(0, 3000));
            }
          }
        });
      });
      f.once('end', () => setTimeout(() => imap.end(), 3000));
    });
  });
});
imap.connect();
