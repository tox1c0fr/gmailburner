function cleanText(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractOtp(subject, body) {
  const combined = `${subject || ''} \n ${body || ''}`;
  const cleaned = cleanText(combined);

  const highConfidencePatterns = [
    /(?:verification|security|confirmation|validation|login|activation|access|one-time|otp|pin|passcode|code)\s*(?:code|number|pin|password)?(?:\s+(?:is|are))?[\s:=-]+([0-9]{4,8})\b/i,
    /\b([0-9]{4,8})\s+(?:is\s+(?:the\s+|your\s+)?(?:[a-z0-9_-]+\s+)?(?:verification|security|confirmation|otp|login|access)\s*(?:code|pin)?)/i,
    /(?:enter|use|input)\s*(?:the)?\s*(?:following)?\s*(?:code|pin|number)?(?:\s+(?:is|are))?[\s:=-]+([0-9]{4,8})\b/i,
    /your\s*code\s*(?:is|:)?[\s:=-]*([0-9]{4,8})\b/i,
    /code\s*de\s*verification\s*(?:est|:)?[\s:=-]*([0-9]{4,8})\b/i,
  ];

  for (const pattern of highConfidencePatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      return {
        code: match[1],
        confidence: 'high',
        pattern: pattern.toString(),
      };
    }
  }

  const subjectMatch = (subject || '').match(/\b([0-9]{4,8})\b/);
  if (subjectMatch) {
    return {
      code: subjectMatch[1],
      confidence: 'medium',
      pattern: 'subject_standalone_digits',
    };
  }

  const isolatedDigits = cleaned.match(/\b([0-9]{6})\b/g);
  if (isolatedDigits && isolatedDigits.length === 1) {
    return {
      code: isolatedDigits[0],
      confidence: 'medium',
      pattern: 'single_6_digits',
    };
  }

  const alphanumericOtpPatterns = [
    /(?:verification|confirmation|security)\s*code\s*(?:is|:|-)?[\s:=-]*([A-Z0-9]{6,8})\b/i,
  ];

  for (const pattern of alphanumericOtpPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      return {
        code: match[1],
        confidence: 'medium',
        pattern: 'alphanumeric',
      };
    }
  }

  return {
    code: null,
    confidence: 'none',
    pattern: null,
  };
}

function extractLinks(bodyHtml, bodyText) {
  const links = new Set();
  const raw = `${bodyHtml || ''} ${bodyText || ''}`;

  const hrefRegex = /href=["'](https?:\/\/[^"'>\s]+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(raw)) !== null) {
    links.add(match[1]);
  }

  const urlRegex = /(https?:\/\/[^\s<>'"]+)/gi;
  while ((match = urlRegex.exec(bodyText || '')) !== null) {
    links.add(match[1]);
  }

  const verificationKeywords = ['verify', 'confirm', 'activate', 'validation', 'token', 'auth', 'magic', 'login'];
  const prioritized = [];
  const others = [];

  for (const link of links) {
    const lower = link.toLowerCase();
    if (verificationKeywords.some(k => lower.includes(k))) {
      prioritized.push(link);
    } else {
      others.push(link);
    }
  }

  return {
    verificationLinks: prioritized,
    allLinks: [...prioritized, ...others],
  };
}

module.exports = {
  extractOtp,
  extractLinks,
  cleanText,
};
