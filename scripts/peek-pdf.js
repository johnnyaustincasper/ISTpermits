const Imap = require('imap');
const { simpleParser } = require('mailparser');
const pdfParse = require('pdf-parse');

const imap = new Imap({
  user: 'Ivebeencelested@gmail.com',
  password: 'vzdldgexansthuxb',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

imap.once('ready', () => {
  imap.openBox('INBOX', true, (err, box) => {
    imap.search(['UNSEEN'], (err, results) => {
      if (!results?.length) { console.log('no unread'); imap.end(); return; }
      const f = imap.fetch([results[0]], { bodies: '' });
      f.on('message', msg => {
        let buf = '';
        msg.on('body', stream => { stream.on('data', d => buf += d); });
        msg.once('end', async () => {
          const parsed = await simpleParser(buf);
          for (const att of (parsed.attachments || [])) {
            if (att.filename?.toLowerCase().includes('job') && att.filename?.endsWith('.pdf')) {
              const data = await pdfParse(att.content);
              console.log('=== PDF TEXT (first 3000 chars) ===');
              console.log(data.text.substring(0, 3000));
              break;
            }
          }
          imap.end();
        });
      });
    });
  });
});
imap.connect();
