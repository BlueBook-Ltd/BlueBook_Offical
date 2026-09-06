globalThis.process ??= {};
globalThis.process.env ??= {};
const textEncoder = new TextEncoder();
const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
  base64Lookup[base64Chars.charCodeAt(i)] = i;
}
function decodeBase64(base642) {
  let bufferLength = Math.ceil(base642.length / 4) * 3;
  const len = base642.length;
  let p = 0;
  if (base642.length % 4 === 3) {
    bufferLength--;
  } else if (base642.length % 4 === 2) {
    bufferLength -= 2;
  } else if (base642[base642.length - 1] === "=") {
    bufferLength--;
    if (base642[base642.length - 2] === "=") {
      bufferLength--;
    }
  }
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < len; i += 4) {
    let encoded1 = base64Lookup[base642.charCodeAt(i)];
    let encoded2 = base64Lookup[base642.charCodeAt(i + 1)];
    let encoded3 = base64Lookup[base642.charCodeAt(i + 2)];
    let encoded4 = base64Lookup[base642.charCodeAt(i + 3)];
    bytes[p++] = encoded1 << 2 | encoded2 >> 4;
    bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
    bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
  }
  return arrayBuffer;
}
function getDecoder(charset) {
  charset = charset || "utf8";
  let decoder;
  try {
    decoder = new TextDecoder(charset);
  } catch (err) {
    decoder = new TextDecoder("windows-1252");
  }
  return decoder;
}
async function blobToArrayBuffer(blob) {
  if ("arrayBuffer" in blob) {
    return await blob.arrayBuffer();
  }
  const fr = new FileReader();
  return new Promise((resolve, reject) => {
    fr.onload = function(e) {
      resolve(e.target.result);
    };
    fr.onerror = function(e) {
      reject(fr.error);
    };
    fr.readAsArrayBuffer(blob);
  });
}
function getHex(c) {
  if (c >= 48 && c <= 57 || c >= 97 && c <= 102 || c >= 65 && c <= 70) {
    return String.fromCharCode(c);
  }
  return false;
}
function decodeWord(charset, encoding, str) {
  let splitPos = charset.indexOf("*");
  if (splitPos >= 0) {
    charset = charset.substr(0, splitPos);
  }
  encoding = encoding.toUpperCase();
  let byteStr;
  if (encoding === "Q") {
    str = str.replace(/=\s+([0-9a-fA-F])/g, "=$1").replace(/[_\s]/g, " ");
    let buf = textEncoder.encode(str);
    let encodedBytes = [];
    for (let i = 0, len = buf.length; i < len; i++) {
      let c = buf[i];
      if (i <= len - 2 && c === 61) {
        let c1 = getHex(buf[i + 1]);
        let c2 = getHex(buf[i + 2]);
        if (c1 && c2) {
          let c3 = parseInt(c1 + c2, 16);
          encodedBytes.push(c3);
          i += 2;
          continue;
        }
      }
      encodedBytes.push(c);
    }
    byteStr = new ArrayBuffer(encodedBytes.length);
    let dataView = new DataView(byteStr);
    for (let i = 0, len = encodedBytes.length; i < len; i++) {
      dataView.setUint8(i, encodedBytes[i]);
    }
  } else if (encoding === "B") {
    byteStr = decodeBase64(str.replace(/[^a-zA-Z0-9\+\/=]+/g, ""));
  } else {
    byteStr = textEncoder.encode(str);
  }
  return getDecoder(charset).decode(byteStr);
}
function decodeWords(str) {
  let joinString = true;
  while (true) {
    let result = (str || "").toString().replace(
      /(=\?([^?]+)\?[Bb]\?([^?]*)\?=)\s*(?==\?([^?]+)\?[Bb]\?[^?]*\?=)/g,
      (match, left, chLeft, encodedLeftStr, chRight) => {
        if (!joinString) {
          return match;
        }
        if (chLeft === chRight && encodedLeftStr.length % 4 === 0 && !/=$/.test(encodedLeftStr)) {
          return left + "__\0JOIN\0__";
        }
        return match;
      }
    ).replace(
      /(=\?([^?]+)\?[Qq]\?[^?]*\?=)\s*(?==\?([^?]+)\?[Qq]\?[^?]*\?=)/g,
      (match, left, chLeft, chRight) => {
        if (!joinString) {
          return match;
        }
        if (chLeft === chRight) {
          return left + "__\0JOIN\0__";
        }
        return match;
      }
    ).replace(/(\?=)?__\x00JOIN\x00__(=\?([^?]+)\?[QqBb]\?)?/g, "").replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, "$1").replace(
      /=\?([\w_\-*]+)\?([QqBb])\?([^?]*)\?=/g,
      (m, charset, encoding, text) => decodeWord(charset, encoding, text)
    );
    if (joinString && result.indexOf("�") >= 0) {
      joinString = false;
    } else {
      return result;
    }
  }
}
function decodeURIComponentWithCharset(encodedStr, charset) {
  charset = charset || "utf-8";
  let encodedBytes = [];
  for (let i = 0; i < encodedStr.length; i++) {
    let c = encodedStr.charAt(i);
    if (c === "%" && /^[a-f0-9]{2}/i.test(encodedStr.substr(i + 1, 2))) {
      let byte = encodedStr.substr(i + 1, 2);
      i += 2;
      encodedBytes.push(parseInt(byte, 16));
    } else if (c.charCodeAt(0) > 126) {
      c = textEncoder.encode(c);
      for (let j = 0; j < c.length; j++) {
        encodedBytes.push(c[j]);
      }
    } else {
      encodedBytes.push(c.charCodeAt(0));
    }
  }
  const byteStr = new ArrayBuffer(encodedBytes.length);
  const dataView = new DataView(byteStr);
  for (let i = 0, len = encodedBytes.length; i < len; i++) {
    dataView.setUint8(i, encodedBytes[i]);
  }
  return getDecoder(charset).decode(byteStr);
}
function decodeParameterValueContinuations(header) {
  let paramKeys = /* @__PURE__ */ new Map();
  Object.keys(header.params).forEach((key) => {
    let match = key.match(/\*((\d+)\*?)?$/);
    if (!match) {
      return;
    }
    let actualKey = key.substr(0, match.index).toLowerCase();
    let nr = Number(match[2]) || 0;
    let paramVal;
    if (!paramKeys.has(actualKey)) {
      paramVal = {
        charset: false,
        values: []
      };
      paramKeys.set(actualKey, paramVal);
    } else {
      paramVal = paramKeys.get(actualKey);
    }
    let value = header.params[key];
    if (nr === 0 && match[0].charAt(match[0].length - 1) === "*" && (match = value.match(/^([^']*)'[^']*'(.*)$/))) {
      paramVal.charset = match[1] || "utf-8";
      value = match[2];
    }
    paramVal.values.push({ nr, value });
    delete header.params[key];
  });
  paramKeys.forEach((paramVal, key) => {
    header.params[key] = decodeURIComponentWithCharset(
      paramVal.values.sort((a, b) => a.nr - b.nr).map((a) => a.value).join(""),
      paramVal.charset
    );
  });
}
class PassThroughDecoder {
  constructor() {
    this.chunks = [];
  }
  update(line) {
    this.chunks.push(line);
    this.chunks.push("\n");
  }
  finalize() {
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
}
class Base64Decoder {
  constructor(opts) {
    opts = opts || {};
    this.decoder = opts.decoder || new TextDecoder();
    this.maxChunkSize = 100 * 1024;
    this.chunks = [];
    this.remainder = "";
  }
  update(buffer) {
    let str = this.decoder.decode(buffer);
    str = str.replace(/[^a-zA-Z0-9+\/]+/g, "");
    this.remainder += str;
    if (this.remainder.length >= this.maxChunkSize) {
      let allowedBytes = Math.floor(this.remainder.length / 4) * 4;
      let base64Str;
      if (allowedBytes === this.remainder.length) {
        base64Str = this.remainder;
        this.remainder = "";
      } else {
        base64Str = this.remainder.substr(0, allowedBytes);
        this.remainder = this.remainder.substr(allowedBytes);
      }
      if (base64Str.length) {
        this.chunks.push(decodeBase64(base64Str));
      }
    }
  }
  finalize() {
    if (this.remainder && !/^=+$/.test(this.remainder)) {
      this.chunks.push(decodeBase64(this.remainder));
    }
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
}
const VALID_QP_REGEX = /^=[a-f0-9]{2}$/i;
const QP_SPLIT_REGEX = /(?==[a-f0-9]{2})/i;
const SOFT_LINE_BREAK_REGEX = /=\r?\n/g;
const PARTIAL_QP_ENDING_REGEX = /=[a-fA-F0-9]?$/;
class QPDecoder {
  constructor(opts) {
    opts = opts || {};
    this.decoder = opts.decoder || new TextDecoder();
    this.maxChunkSize = 100 * 1024;
    this.remainder = "";
    this.chunks = [];
  }
  decodeQPBytes(encodedBytes) {
    let buf = new ArrayBuffer(encodedBytes.length);
    let dataView = new DataView(buf);
    for (let i = 0, len = encodedBytes.length; i < len; i++) {
      dataView.setUint8(i, parseInt(encodedBytes[i], 16));
    }
    return buf;
  }
  decodeChunks(str) {
    str = str.replace(SOFT_LINE_BREAK_REGEX, "");
    let list = str.split(QP_SPLIT_REGEX);
    let encodedBytes = [];
    for (let part of list) {
      if (part.charAt(0) !== "=") {
        if (encodedBytes.length) {
          this.chunks.push(this.decodeQPBytes(encodedBytes));
          encodedBytes = [];
        }
        this.chunks.push(part);
        continue;
      }
      if (part.length === 3) {
        if (VALID_QP_REGEX.test(part)) {
          encodedBytes.push(part.substr(1));
        } else {
          if (encodedBytes.length) {
            this.chunks.push(this.decodeQPBytes(encodedBytes));
            encodedBytes = [];
          }
          this.chunks.push(part);
        }
        continue;
      }
      if (part.length > 3) {
        const firstThree = part.substr(0, 3);
        if (VALID_QP_REGEX.test(firstThree)) {
          encodedBytes.push(part.substr(1, 2));
          this.chunks.push(this.decodeQPBytes(encodedBytes));
          encodedBytes = [];
          part = part.substr(3);
          this.chunks.push(part);
        } else {
          if (encodedBytes.length) {
            this.chunks.push(this.decodeQPBytes(encodedBytes));
            encodedBytes = [];
          }
          this.chunks.push(part);
        }
      }
    }
    if (encodedBytes.length) {
      this.chunks.push(this.decodeQPBytes(encodedBytes));
    }
  }
  update(buffer) {
    let str = this.decoder.decode(buffer) + "\n";
    str = this.remainder + str;
    if (str.length < this.maxChunkSize) {
      this.remainder = str;
      return;
    }
    this.remainder = "";
    let partialEnding = str.match(PARTIAL_QP_ENDING_REGEX);
    if (partialEnding) {
      if (partialEnding.index === 0) {
        this.remainder = str;
        return;
      }
      this.remainder = str.substr(partialEnding.index);
      str = str.substr(0, partialEnding.index);
    }
    this.decodeChunks(str);
  }
  finalize() {
    if (this.remainder.length) {
      this.decodeChunks(this.remainder);
      this.remainder = "";
    }
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
}
const defaultDecoder = getDecoder();
class MimeNode {
  constructor(options) {
    this.options = options || {};
    this.postalMime = this.options.postalMime;
    this.root = !!this.options.parentNode;
    this.childNodes = [];
    if (this.options.parentNode) {
      this.parentNode = this.options.parentNode;
      this.depth = this.parentNode.depth + 1;
      if (this.depth > this.options.maxNestingDepth) {
        throw new Error(`Maximum MIME nesting depth of ${this.options.maxNestingDepth} levels exceeded`);
      }
      this.options.parentNode.childNodes.push(this);
    } else {
      this.depth = 0;
    }
    this.state = "header";
    this.headerLines = [];
    this.headerSize = 0;
    const parentMultipartType = this.options.parentMultipartType || null;
    const defaultContentType = parentMultipartType === "digest" ? "message/rfc822" : "text/plain";
    this.contentType = {
      value: defaultContentType,
      default: true
    };
    this.contentTransferEncoding = {
      value: "8bit"
    };
    this.contentDisposition = {
      value: ""
    };
    this.headers = [];
    this.contentDecoder = false;
  }
  setupContentDecoder(transferEncoding) {
    if (/base64/i.test(transferEncoding)) {
      this.contentDecoder = new Base64Decoder();
    } else if (/quoted-printable/i.test(transferEncoding)) {
      this.contentDecoder = new QPDecoder({ decoder: getDecoder(this.contentType.parsed.params.charset) });
    } else {
      this.contentDecoder = new PassThroughDecoder();
    }
  }
  async finalize() {
    if (this.state === "finished") {
      return;
    }
    if (this.state === "header") {
      this.processHeaders();
    }
    let boundaries = this.postalMime.boundaries;
    for (let i = boundaries.length - 1; i >= 0; i--) {
      let boundary = boundaries[i];
      if (boundary.node === this) {
        boundaries.splice(i, 1);
        break;
      }
    }
    await this.finalizeChildNodes();
    this.content = this.contentDecoder ? await this.contentDecoder.finalize() : null;
    this.state = "finished";
  }
  async finalizeChildNodes() {
    for (let childNode of this.childNodes) {
      await childNode.finalize();
    }
  }
  // Strip RFC 822 comments (parenthesized text) from structured header values
  stripComments(str) {
    let result = "";
    let depth = 0;
    let escaped = false;
    let inQuote = false;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charAt(i);
      if (escaped) {
        if (depth === 0) {
          result += chr;
        }
        escaped = false;
        continue;
      }
      if (chr === "\\") {
        escaped = true;
        if (depth === 0) {
          result += chr;
        }
        continue;
      }
      if (chr === '"' && depth === 0) {
        inQuote = !inQuote;
        result += chr;
        continue;
      }
      if (!inQuote) {
        if (chr === "(") {
          depth++;
          continue;
        }
        if (chr === ")" && depth > 0) {
          depth--;
          continue;
        }
      }
      if (depth === 0) {
        result += chr;
      }
    }
    return result;
  }
  parseStructuredHeader(str) {
    str = this.stripComments(str);
    let response = {
      value: false,
      params: {}
    };
    let key = false;
    let value = "";
    let stage = "value";
    let quote = false;
    let escaped = false;
    let chr;
    for (let i = 0, len = str.length; i < len; i++) {
      chr = str.charAt(i);
      switch (stage) {
        case "key":
          if (chr === "=") {
            key = value.trim().toLowerCase();
            stage = "value";
            value = "";
            break;
          }
          value += chr;
          break;
        case "value":
          if (escaped) {
            value += chr;
          } else if (chr === "\\") {
            escaped = true;
            continue;
          } else if (quote && chr === quote) {
            quote = false;
          } else if (!quote && chr === '"') {
            quote = chr;
          } else if (!quote && chr === ";") {
            if (key === false) {
              response.value = value.trim();
            } else {
              response.params[key] = value.trim();
            }
            stage = "key";
            value = "";
          } else {
            value += chr;
          }
          escaped = false;
          break;
      }
    }
    value = value.trim();
    if (stage === "value") {
      if (key === false) {
        response.value = value;
      } else {
        response.params[key] = value;
      }
    } else if (value) {
      response.params[value.toLowerCase()] = "";
    }
    if (response.value) {
      response.value = response.value.toLowerCase();
    }
    decodeParameterValueContinuations(response);
    return response;
  }
  decodeFlowedText(str, delSp) {
    return str.split(/\r?\n/).reduce((previousValue, currentValue) => {
      if (previousValue.endsWith(" ") && previousValue !== "-- " && !previousValue.endsWith("\n-- ")) {
        if (delSp) {
          return previousValue.slice(0, -1) + currentValue;
        } else {
          return previousValue + currentValue;
        }
      } else {
        return previousValue + "\n" + currentValue;
      }
    }).replace(/^ /gm, "");
  }
  getTextContent() {
    if (!this.content) {
      return "";
    }
    let str = getDecoder(this.contentType.parsed.params.charset).decode(this.content);
    if (/^flowed$/i.test(this.contentType.parsed.params.format)) {
      str = this.decodeFlowedText(str, /^yes$/i.test(this.contentType.parsed.params.delsp));
    }
    return str;
  }
  processHeaders() {
    for (let i = this.headerLines.length - 1; i >= 0; i--) {
      let line = this.headerLines[i];
      if (i && /^\s/.test(line)) {
        this.headerLines[i - 1] += "\n" + line;
        this.headerLines.splice(i, 1);
      }
    }
    this.rawHeaderLines = [];
    for (let i = this.headerLines.length - 1; i >= 0; i--) {
      let rawLine = this.headerLines[i];
      let sep = rawLine.indexOf(":");
      let rawKey = sep < 0 ? rawLine.trim() : rawLine.substr(0, sep).trim();
      this.rawHeaderLines.push({
        key: rawKey.toLowerCase(),
        line: rawLine
      });
      let normalizedLine = rawLine.replace(/\s+/g, " ");
      sep = normalizedLine.indexOf(":");
      let key = sep < 0 ? normalizedLine.trim() : normalizedLine.substr(0, sep).trim();
      let value = sep < 0 ? "" : normalizedLine.substr(sep + 1).trim();
      this.headers.push({ key: key.toLowerCase(), originalKey: key, value });
      switch (key.toLowerCase()) {
        case "content-type":
          if (this.contentType.default) {
            this.contentType = { value, parsed: {} };
          }
          break;
        case "content-transfer-encoding":
          this.contentTransferEncoding = { value, parsed: {} };
          break;
        case "content-disposition":
          this.contentDisposition = { value, parsed: {} };
          break;
        case "content-id":
          this.contentId = value;
          break;
        case "content-description":
          this.contentDescription = value;
          break;
      }
    }
    this.contentType.parsed = this.parseStructuredHeader(this.contentType.value);
    this.contentType.multipart = /^multipart\//i.test(this.contentType.parsed.value) ? this.contentType.parsed.value.substr(this.contentType.parsed.value.indexOf("/") + 1) : false;
    if (this.contentType.multipart && this.contentType.parsed.params.boundary) {
      this.postalMime.boundaries.push({
        value: textEncoder.encode(this.contentType.parsed.params.boundary),
        node: this
      });
    }
    this.contentDisposition.parsed = this.parseStructuredHeader(this.contentDisposition.value);
    this.contentTransferEncoding.encoding = this.contentTransferEncoding.value.toLowerCase().split(/[^\w-]/).shift();
    this.setupContentDecoder(this.contentTransferEncoding.encoding);
  }
  feed(line) {
    switch (this.state) {
      case "header":
        if (!line.length) {
          this.state = "body";
          return this.processHeaders();
        }
        this.headerSize += line.length;
        if (this.headerSize > this.options.maxHeadersSize) {
          let error = new Error(`Maximum header size of ${this.options.maxHeadersSize} bytes exceeded`);
          throw error;
        }
        this.headerLines.push(defaultDecoder.decode(line));
        break;
      case "body": {
        this.contentDecoder.update(line);
      }
    }
  }
}
const htmlEntities = {
  "&AElig": "Æ",
  "&AElig;": "Æ",
  "&AMP": "&",
  "&AMP;": "&",
  "&Aacute": "Á",
  "&Aacute;": "Á",
  "&Abreve;": "Ă",
  "&Acirc": "Â",
  "&Acirc;": "Â",
  "&Acy;": "А",
  "&Afr;": "𝔄",
  "&Agrave": "À",
  "&Agrave;": "À",
  "&Alpha;": "Α",
  "&Amacr;": "Ā",
  "&And;": "⩓",
  "&Aogon;": "Ą",
  "&Aopf;": "𝔸",
  "&ApplyFunction;": "⁡",
  "&Aring": "Å",
  "&Aring;": "Å",
  "&Ascr;": "𝒜",
  "&Assign;": "≔",
  "&Atilde": "Ã",
  "&Atilde;": "Ã",
  "&Auml": "Ä",
  "&Auml;": "Ä",
  "&Backslash;": "∖",
  "&Barv;": "⫧",
  "&Barwed;": "⌆",
  "&Bcy;": "Б",
  "&Because;": "∵",
  "&Bernoullis;": "ℬ",
  "&Beta;": "Β",
  "&Bfr;": "𝔅",
  "&Bopf;": "𝔹",
  "&Breve;": "˘",
  "&Bscr;": "ℬ",
  "&Bumpeq;": "≎",
  "&CHcy;": "Ч",
  "&COPY": "©",
  "&COPY;": "©",
  "&Cacute;": "Ć",
  "&Cap;": "⋒",
  "&CapitalDifferentialD;": "ⅅ",
  "&Cayleys;": "ℭ",
  "&Ccaron;": "Č",
  "&Ccedil": "Ç",
  "&Ccedil;": "Ç",
  "&Ccirc;": "Ĉ",
  "&Cconint;": "∰",
  "&Cdot;": "Ċ",
  "&Cedilla;": "¸",
  "&CenterDot;": "·",
  "&Cfr;": "ℭ",
  "&Chi;": "Χ",
  "&CircleDot;": "⊙",
  "&CircleMinus;": "⊖",
  "&CirclePlus;": "⊕",
  "&CircleTimes;": "⊗",
  "&ClockwiseContourIntegral;": "∲",
  "&CloseCurlyDoubleQuote;": "”",
  "&CloseCurlyQuote;": "’",
  "&Colon;": "∷",
  "&Colone;": "⩴",
  "&Congruent;": "≡",
  "&Conint;": "∯",
  "&ContourIntegral;": "∮",
  "&Copf;": "ℂ",
  "&Coproduct;": "∐",
  "&CounterClockwiseContourIntegral;": "∳",
  "&Cross;": "⨯",
  "&Cscr;": "𝒞",
  "&Cup;": "⋓",
  "&CupCap;": "≍",
  "&DD;": "ⅅ",
  "&DDotrahd;": "⤑",
  "&DJcy;": "Ђ",
  "&DScy;": "Ѕ",
  "&DZcy;": "Џ",
  "&Dagger;": "‡",
  "&Darr;": "↡",
  "&Dashv;": "⫤",
  "&Dcaron;": "Ď",
  "&Dcy;": "Д",
  "&Del;": "∇",
  "&Delta;": "Δ",
  "&Dfr;": "𝔇",
  "&DiacriticalAcute;": "´",
  "&DiacriticalDot;": "˙",
  "&DiacriticalDoubleAcute;": "˝",
  "&DiacriticalGrave;": "`",
  "&DiacriticalTilde;": "˜",
  "&Diamond;": "⋄",
  "&DifferentialD;": "ⅆ",
  "&Dopf;": "𝔻",
  "&Dot;": "¨",
  "&DotDot;": "⃜",
  "&DotEqual;": "≐",
  "&DoubleContourIntegral;": "∯",
  "&DoubleDot;": "¨",
  "&DoubleDownArrow;": "⇓",
  "&DoubleLeftArrow;": "⇐",
  "&DoubleLeftRightArrow;": "⇔",
  "&DoubleLeftTee;": "⫤",
  "&DoubleLongLeftArrow;": "⟸",
  "&DoubleLongLeftRightArrow;": "⟺",
  "&DoubleLongRightArrow;": "⟹",
  "&DoubleRightArrow;": "⇒",
  "&DoubleRightTee;": "⊨",
  "&DoubleUpArrow;": "⇑",
  "&DoubleUpDownArrow;": "⇕",
  "&DoubleVerticalBar;": "∥",
  "&DownArrow;": "↓",
  "&DownArrowBar;": "⤓",
  "&DownArrowUpArrow;": "⇵",
  "&DownBreve;": "̑",
  "&DownLeftRightVector;": "⥐",
  "&DownLeftTeeVector;": "⥞",
  "&DownLeftVector;": "↽",
  "&DownLeftVectorBar;": "⥖",
  "&DownRightTeeVector;": "⥟",
  "&DownRightVector;": "⇁",
  "&DownRightVectorBar;": "⥗",
  "&DownTee;": "⊤",
  "&DownTeeArrow;": "↧",
  "&Downarrow;": "⇓",
  "&Dscr;": "𝒟",
  "&Dstrok;": "Đ",
  "&ENG;": "Ŋ",
  "&ETH": "Ð",
  "&ETH;": "Ð",
  "&Eacute": "É",
  "&Eacute;": "É",
  "&Ecaron;": "Ě",
  "&Ecirc": "Ê",
  "&Ecirc;": "Ê",
  "&Ecy;": "Э",
  "&Edot;": "Ė",
  "&Efr;": "𝔈",
  "&Egrave": "È",
  "&Egrave;": "È",
  "&Element;": "∈",
  "&Emacr;": "Ē",
  "&EmptySmallSquare;": "◻",
  "&EmptyVerySmallSquare;": "▫",
  "&Eogon;": "Ę",
  "&Eopf;": "𝔼",
  "&Epsilon;": "Ε",
  "&Equal;": "⩵",
  "&EqualTilde;": "≂",
  "&Equilibrium;": "⇌",
  "&Escr;": "ℰ",
  "&Esim;": "⩳",
  "&Eta;": "Η",
  "&Euml": "Ë",
  "&Euml;": "Ë",
  "&Exists;": "∃",
  "&ExponentialE;": "ⅇ",
  "&Fcy;": "Ф",
  "&Ffr;": "𝔉",
  "&FilledSmallSquare;": "◼",
  "&FilledVerySmallSquare;": "▪",
  "&Fopf;": "𝔽",
  "&ForAll;": "∀",
  "&Fouriertrf;": "ℱ",
  "&Fscr;": "ℱ",
  "&GJcy;": "Ѓ",
  "&GT": ">",
  "&GT;": ">",
  "&Gamma;": "Γ",
  "&Gammad;": "Ϝ",
  "&Gbreve;": "Ğ",
  "&Gcedil;": "Ģ",
  "&Gcirc;": "Ĝ",
  "&Gcy;": "Г",
  "&Gdot;": "Ġ",
  "&Gfr;": "𝔊",
  "&Gg;": "⋙",
  "&Gopf;": "𝔾",
  "&GreaterEqual;": "≥",
  "&GreaterEqualLess;": "⋛",
  "&GreaterFullEqual;": "≧",
  "&GreaterGreater;": "⪢",
  "&GreaterLess;": "≷",
  "&GreaterSlantEqual;": "⩾",
  "&GreaterTilde;": "≳",
  "&Gscr;": "𝒢",
  "&Gt;": "≫",
  "&HARDcy;": "Ъ",
  "&Hacek;": "ˇ",
  "&Hat;": "^",
  "&Hcirc;": "Ĥ",
  "&Hfr;": "ℌ",
  "&HilbertSpace;": "ℋ",
  "&Hopf;": "ℍ",
  "&HorizontalLine;": "─",
  "&Hscr;": "ℋ",
  "&Hstrok;": "Ħ",
  "&HumpDownHump;": "≎",
  "&HumpEqual;": "≏",
  "&IEcy;": "Е",
  "&IJlig;": "Ĳ",
  "&IOcy;": "Ё",
  "&Iacute": "Í",
  "&Iacute;": "Í",
  "&Icirc": "Î",
  "&Icirc;": "Î",
  "&Icy;": "И",
  "&Idot;": "İ",
  "&Ifr;": "ℑ",
  "&Igrave": "Ì",
  "&Igrave;": "Ì",
  "&Im;": "ℑ",
  "&Imacr;": "Ī",
  "&ImaginaryI;": "ⅈ",
  "&Implies;": "⇒",
  "&Int;": "∬",
  "&Integral;": "∫",
  "&Intersection;": "⋂",
  "&InvisibleComma;": "⁣",
  "&InvisibleTimes;": "⁢",
  "&Iogon;": "Į",
  "&Iopf;": "𝕀",
  "&Iota;": "Ι",
  "&Iscr;": "ℐ",
  "&Itilde;": "Ĩ",
  "&Iukcy;": "І",
  "&Iuml": "Ï",
  "&Iuml;": "Ï",
  "&Jcirc;": "Ĵ",
  "&Jcy;": "Й",
  "&Jfr;": "𝔍",
  "&Jopf;": "𝕁",
  "&Jscr;": "𝒥",
  "&Jsercy;": "Ј",
  "&Jukcy;": "Є",
  "&KHcy;": "Х",
  "&KJcy;": "Ќ",
  "&Kappa;": "Κ",
  "&Kcedil;": "Ķ",
  "&Kcy;": "К",
  "&Kfr;": "𝔎",
  "&Kopf;": "𝕂",
  "&Kscr;": "𝒦",
  "&LJcy;": "Љ",
  "&LT": "<",
  "&LT;": "<",
  "&Lacute;": "Ĺ",
  "&Lambda;": "Λ",
  "&Lang;": "⟪",
  "&Laplacetrf;": "ℒ",
  "&Larr;": "↞",
  "&Lcaron;": "Ľ",
  "&Lcedil;": "Ļ",
  "&Lcy;": "Л",
  "&LeftAngleBracket;": "⟨",
  "&LeftArrow;": "←",
  "&LeftArrowBar;": "⇤",
  "&LeftArrowRightArrow;": "⇆",
  "&LeftCeiling;": "⌈",
  "&LeftDoubleBracket;": "⟦",
  "&LeftDownTeeVector;": "⥡",
  "&LeftDownVector;": "⇃",
  "&LeftDownVectorBar;": "⥙",
  "&LeftFloor;": "⌊",
  "&LeftRightArrow;": "↔",
  "&LeftRightVector;": "⥎",
  "&LeftTee;": "⊣",
  "&LeftTeeArrow;": "↤",
  "&LeftTeeVector;": "⥚",
  "&LeftTriangle;": "⊲",
  "&LeftTriangleBar;": "⧏",
  "&LeftTriangleEqual;": "⊴",
  "&LeftUpDownVector;": "⥑",
  "&LeftUpTeeVector;": "⥠",
  "&LeftUpVector;": "↿",
  "&LeftUpVectorBar;": "⥘",
  "&LeftVector;": "↼",
  "&LeftVectorBar;": "⥒",
  "&Leftarrow;": "⇐",
  "&Leftrightarrow;": "⇔",
  "&LessEqualGreater;": "⋚",
  "&LessFullEqual;": "≦",
  "&LessGreater;": "≶",
  "&LessLess;": "⪡",
  "&LessSlantEqual;": "⩽",
  "&LessTilde;": "≲",
  "&Lfr;": "𝔏",
  "&Ll;": "⋘",
  "&Lleftarrow;": "⇚",
  "&Lmidot;": "Ŀ",
  "&LongLeftArrow;": "⟵",
  "&LongLeftRightArrow;": "⟷",
  "&LongRightArrow;": "⟶",
  "&Longleftarrow;": "⟸",
  "&Longleftrightarrow;": "⟺",
  "&Longrightarrow;": "⟹",
  "&Lopf;": "𝕃",
  "&LowerLeftArrow;": "↙",
  "&LowerRightArrow;": "↘",
  "&Lscr;": "ℒ",
  "&Lsh;": "↰",
  "&Lstrok;": "Ł",
  "&Lt;": "≪",
  "&Map;": "⤅",
  "&Mcy;": "М",
  "&MediumSpace;": " ",
  "&Mellintrf;": "ℳ",
  "&Mfr;": "𝔐",
  "&MinusPlus;": "∓",
  "&Mopf;": "𝕄",
  "&Mscr;": "ℳ",
  "&Mu;": "Μ",
  "&NJcy;": "Њ",
  "&Nacute;": "Ń",
  "&Ncaron;": "Ň",
  "&Ncedil;": "Ņ",
  "&Ncy;": "Н",
  "&NegativeMediumSpace;": "​",
  "&NegativeThickSpace;": "​",
  "&NegativeThinSpace;": "​",
  "&NegativeVeryThinSpace;": "​",
  "&NestedGreaterGreater;": "≫",
  "&NestedLessLess;": "≪",
  "&NewLine;": "\n",
  "&Nfr;": "𝔑",
  "&NoBreak;": "⁠",
  "&NonBreakingSpace;": " ",
  "&Nopf;": "ℕ",
  "&Not;": "⫬",
  "&NotCongruent;": "≢",
  "&NotCupCap;": "≭",
  "&NotDoubleVerticalBar;": "∦",
  "&NotElement;": "∉",
  "&NotEqual;": "≠",
  "&NotEqualTilde;": "≂̸",
  "&NotExists;": "∄",
  "&NotGreater;": "≯",
  "&NotGreaterEqual;": "≱",
  "&NotGreaterFullEqual;": "≧̸",
  "&NotGreaterGreater;": "≫̸",
  "&NotGreaterLess;": "≹",
  "&NotGreaterSlantEqual;": "⩾̸",
  "&NotGreaterTilde;": "≵",
  "&NotHumpDownHump;": "≎̸",
  "&NotHumpEqual;": "≏̸",
  "&NotLeftTriangle;": "⋪",
  "&NotLeftTriangleBar;": "⧏̸",
  "&NotLeftTriangleEqual;": "⋬",
  "&NotLess;": "≮",
  "&NotLessEqual;": "≰",
  "&NotLessGreater;": "≸",
  "&NotLessLess;": "≪̸",
  "&NotLessSlantEqual;": "⩽̸",
  "&NotLessTilde;": "≴",
  "&NotNestedGreaterGreater;": "⪢̸",
  "&NotNestedLessLess;": "⪡̸",
  "&NotPrecedes;": "⊀",
  "&NotPrecedesEqual;": "⪯̸",
  "&NotPrecedesSlantEqual;": "⋠",
  "&NotReverseElement;": "∌",
  "&NotRightTriangle;": "⋫",
  "&NotRightTriangleBar;": "⧐̸",
  "&NotRightTriangleEqual;": "⋭",
  "&NotSquareSubset;": "⊏̸",
  "&NotSquareSubsetEqual;": "⋢",
  "&NotSquareSuperset;": "⊐̸",
  "&NotSquareSupersetEqual;": "⋣",
  "&NotSubset;": "⊂⃒",
  "&NotSubsetEqual;": "⊈",
  "&NotSucceeds;": "⊁",
  "&NotSucceedsEqual;": "⪰̸",
  "&NotSucceedsSlantEqual;": "⋡",
  "&NotSucceedsTilde;": "≿̸",
  "&NotSuperset;": "⊃⃒",
  "&NotSupersetEqual;": "⊉",
  "&NotTilde;": "≁",
  "&NotTildeEqual;": "≄",
  "&NotTildeFullEqual;": "≇",
  "&NotTildeTilde;": "≉",
  "&NotVerticalBar;": "∤",
  "&Nscr;": "𝒩",
  "&Ntilde": "Ñ",
  "&Ntilde;": "Ñ",
  "&Nu;": "Ν",
  "&OElig;": "Œ",
  "&Oacute": "Ó",
  "&Oacute;": "Ó",
  "&Ocirc": "Ô",
  "&Ocirc;": "Ô",
  "&Ocy;": "О",
  "&Odblac;": "Ő",
  "&Ofr;": "𝔒",
  "&Ograve": "Ò",
  "&Ograve;": "Ò",
  "&Omacr;": "Ō",
  "&Omega;": "Ω",
  "&Omicron;": "Ο",
  "&Oopf;": "𝕆",
  "&OpenCurlyDoubleQuote;": "“",
  "&OpenCurlyQuote;": "‘",
  "&Or;": "⩔",
  "&Oscr;": "𝒪",
  "&Oslash": "Ø",
  "&Oslash;": "Ø",
  "&Otilde": "Õ",
  "&Otilde;": "Õ",
  "&Otimes;": "⨷",
  "&Ouml": "Ö",
  "&Ouml;": "Ö",
  "&OverBar;": "‾",
  "&OverBrace;": "⏞",
  "&OverBracket;": "⎴",
  "&OverParenthesis;": "⏜",
  "&PartialD;": "∂",
  "&Pcy;": "П",
  "&Pfr;": "𝔓",
  "&Phi;": "Φ",
  "&Pi;": "Π",
  "&PlusMinus;": "±",
  "&Poincareplane;": "ℌ",
  "&Popf;": "ℙ",
  "&Pr;": "⪻",
  "&Precedes;": "≺",
  "&PrecedesEqual;": "⪯",
  "&PrecedesSlantEqual;": "≼",
  "&PrecedesTilde;": "≾",
  "&Prime;": "″",
  "&Product;": "∏",
  "&Proportion;": "∷",
  "&Proportional;": "∝",
  "&Pscr;": "𝒫",
  "&Psi;": "Ψ",
  "&QUOT": '"',
  "&QUOT;": '"',
  "&Qfr;": "𝔔",
  "&Qopf;": "ℚ",
  "&Qscr;": "𝒬",
  "&RBarr;": "⤐",
  "&REG": "®",
  "&REG;": "®",
  "&Racute;": "Ŕ",
  "&Rang;": "⟫",
  "&Rarr;": "↠",
  "&Rarrtl;": "⤖",
  "&Rcaron;": "Ř",
  "&Rcedil;": "Ŗ",
  "&Rcy;": "Р",
  "&Re;": "ℜ",
  "&ReverseElement;": "∋",
  "&ReverseEquilibrium;": "⇋",
  "&ReverseUpEquilibrium;": "⥯",
  "&Rfr;": "ℜ",
  "&Rho;": "Ρ",
  "&RightAngleBracket;": "⟩",
  "&RightArrow;": "→",
  "&RightArrowBar;": "⇥",
  "&RightArrowLeftArrow;": "⇄",
  "&RightCeiling;": "⌉",
  "&RightDoubleBracket;": "⟧",
  "&RightDownTeeVector;": "⥝",
  "&RightDownVector;": "⇂",
  "&RightDownVectorBar;": "⥕",
  "&RightFloor;": "⌋",
  "&RightTee;": "⊢",
  "&RightTeeArrow;": "↦",
  "&RightTeeVector;": "⥛",
  "&RightTriangle;": "⊳",
  "&RightTriangleBar;": "⧐",
  "&RightTriangleEqual;": "⊵",
  "&RightUpDownVector;": "⥏",
  "&RightUpTeeVector;": "⥜",
  "&RightUpVector;": "↾",
  "&RightUpVectorBar;": "⥔",
  "&RightVector;": "⇀",
  "&RightVectorBar;": "⥓",
  "&Rightarrow;": "⇒",
  "&Ropf;": "ℝ",
  "&RoundImplies;": "⥰",
  "&Rrightarrow;": "⇛",
  "&Rscr;": "ℛ",
  "&Rsh;": "↱",
  "&RuleDelayed;": "⧴",
  "&SHCHcy;": "Щ",
  "&SHcy;": "Ш",
  "&SOFTcy;": "Ь",
  "&Sacute;": "Ś",
  "&Sc;": "⪼",
  "&Scaron;": "Š",
  "&Scedil;": "Ş",
  "&Scirc;": "Ŝ",
  "&Scy;": "С",
  "&Sfr;": "𝔖",
  "&ShortDownArrow;": "↓",
  "&ShortLeftArrow;": "←",
  "&ShortRightArrow;": "→",
  "&ShortUpArrow;": "↑",
  "&Sigma;": "Σ",
  "&SmallCircle;": "∘",
  "&Sopf;": "𝕊",
  "&Sqrt;": "√",
  "&Square;": "□",
  "&SquareIntersection;": "⊓",
  "&SquareSubset;": "⊏",
  "&SquareSubsetEqual;": "⊑",
  "&SquareSuperset;": "⊐",
  "&SquareSupersetEqual;": "⊒",
  "&SquareUnion;": "⊔",
  "&Sscr;": "𝒮",
  "&Star;": "⋆",
  "&Sub;": "⋐",
  "&Subset;": "⋐",
  "&SubsetEqual;": "⊆",
  "&Succeeds;": "≻",
  "&SucceedsEqual;": "⪰",
  "&SucceedsSlantEqual;": "≽",
  "&SucceedsTilde;": "≿",
  "&SuchThat;": "∋",
  "&Sum;": "∑",
  "&Sup;": "⋑",
  "&Superset;": "⊃",
  "&SupersetEqual;": "⊇",
  "&Supset;": "⋑",
  "&THORN": "Þ",
  "&THORN;": "Þ",
  "&TRADE;": "™",
  "&TSHcy;": "Ћ",
  "&TScy;": "Ц",
  "&Tab;": "	",
  "&Tau;": "Τ",
  "&Tcaron;": "Ť",
  "&Tcedil;": "Ţ",
  "&Tcy;": "Т",
  "&Tfr;": "𝔗",
  "&Therefore;": "∴",
  "&Theta;": "Θ",
  "&ThickSpace;": "  ",
  "&ThinSpace;": " ",
  "&Tilde;": "∼",
  "&TildeEqual;": "≃",
  "&TildeFullEqual;": "≅",
  "&TildeTilde;": "≈",
  "&Topf;": "𝕋",
  "&TripleDot;": "⃛",
  "&Tscr;": "𝒯",
  "&Tstrok;": "Ŧ",
  "&Uacute": "Ú",
  "&Uacute;": "Ú",
  "&Uarr;": "↟",
  "&Uarrocir;": "⥉",
  "&Ubrcy;": "Ў",
  "&Ubreve;": "Ŭ",
  "&Ucirc": "Û",
  "&Ucirc;": "Û",
  "&Ucy;": "У",
  "&Udblac;": "Ű",
  "&Ufr;": "𝔘",
  "&Ugrave": "Ù",
  "&Ugrave;": "Ù",
  "&Umacr;": "Ū",
  "&UnderBar;": "_",
  "&UnderBrace;": "⏟",
  "&UnderBracket;": "⎵",
  "&UnderParenthesis;": "⏝",
  "&Union;": "⋃",
  "&UnionPlus;": "⊎",
  "&Uogon;": "Ų",
  "&Uopf;": "𝕌",
  "&UpArrow;": "↑",
  "&UpArrowBar;": "⤒",
  "&UpArrowDownArrow;": "⇅",
  "&UpDownArrow;": "↕",
  "&UpEquilibrium;": "⥮",
  "&UpTee;": "⊥",
  "&UpTeeArrow;": "↥",
  "&Uparrow;": "⇑",
  "&Updownarrow;": "⇕",
  "&UpperLeftArrow;": "↖",
  "&UpperRightArrow;": "↗",
  "&Upsi;": "ϒ",
  "&Upsilon;": "Υ",
  "&Uring;": "Ů",
  "&Uscr;": "𝒰",
  "&Utilde;": "Ũ",
  "&Uuml": "Ü",
  "&Uuml;": "Ü",
  "&VDash;": "⊫",
  "&Vbar;": "⫫",
  "&Vcy;": "В",
  "&Vdash;": "⊩",
  "&Vdashl;": "⫦",
  "&Vee;": "⋁",
  "&Verbar;": "‖",
  "&Vert;": "‖",
  "&VerticalBar;": "∣",
  "&VerticalLine;": "|",
  "&VerticalSeparator;": "❘",
  "&VerticalTilde;": "≀",
  "&VeryThinSpace;": " ",
  "&Vfr;": "𝔙",
  "&Vopf;": "𝕍",
  "&Vscr;": "𝒱",
  "&Vvdash;": "⊪",
  "&Wcirc;": "Ŵ",
  "&Wedge;": "⋀",
  "&Wfr;": "𝔚",
  "&Wopf;": "𝕎",
  "&Wscr;": "𝒲",
  "&Xfr;": "𝔛",
  "&Xi;": "Ξ",
  "&Xopf;": "𝕏",
  "&Xscr;": "𝒳",
  "&YAcy;": "Я",
  "&YIcy;": "Ї",
  "&YUcy;": "Ю",
  "&Yacute": "Ý",
  "&Yacute;": "Ý",
  "&Ycirc;": "Ŷ",
  "&Ycy;": "Ы",
  "&Yfr;": "𝔜",
  "&Yopf;": "𝕐",
  "&Yscr;": "𝒴",
  "&Yuml;": "Ÿ",
  "&ZHcy;": "Ж",
  "&Zacute;": "Ź",
  "&Zcaron;": "Ž",
  "&Zcy;": "З",
  "&Zdot;": "Ż",
  "&ZeroWidthSpace;": "​",
  "&Zeta;": "Ζ",
  "&Zfr;": "ℨ",
  "&Zopf;": "ℤ",
  "&Zscr;": "𝒵",
  "&aacute": "á",
  "&aacute;": "á",
  "&abreve;": "ă",
  "&ac;": "∾",
  "&acE;": "∾̳",
  "&acd;": "∿",
  "&acirc": "â",
  "&acirc;": "â",
  "&acute": "´",
  "&acute;": "´",
  "&acy;": "а",
  "&aelig": "æ",
  "&aelig;": "æ",
  "&af;": "⁡",
  "&afr;": "𝔞",
  "&agrave": "à",
  "&agrave;": "à",
  "&alefsym;": "ℵ",
  "&aleph;": "ℵ",
  "&alpha;": "α",
  "&amacr;": "ā",
  "&amalg;": "⨿",
  "&amp": "&",
  "&amp;": "&",
  "&and;": "∧",
  "&andand;": "⩕",
  "&andd;": "⩜",
  "&andslope;": "⩘",
  "&andv;": "⩚",
  "&ang;": "∠",
  "&ange;": "⦤",
  "&angle;": "∠",
  "&angmsd;": "∡",
  "&angmsdaa;": "⦨",
  "&angmsdab;": "⦩",
  "&angmsdac;": "⦪",
  "&angmsdad;": "⦫",
  "&angmsdae;": "⦬",
  "&angmsdaf;": "⦭",
  "&angmsdag;": "⦮",
  "&angmsdah;": "⦯",
  "&angrt;": "∟",
  "&angrtvb;": "⊾",
  "&angrtvbd;": "⦝",
  "&angsph;": "∢",
  "&angst;": "Å",
  "&angzarr;": "⍼",
  "&aogon;": "ą",
  "&aopf;": "𝕒",
  "&ap;": "≈",
  "&apE;": "⩰",
  "&apacir;": "⩯",
  "&ape;": "≊",
  "&apid;": "≋",
  "&apos;": "'",
  "&approx;": "≈",
  "&approxeq;": "≊",
  "&aring": "å",
  "&aring;": "å",
  "&ascr;": "𝒶",
  "&ast;": "*",
  "&asymp;": "≈",
  "&asympeq;": "≍",
  "&atilde": "ã",
  "&atilde;": "ã",
  "&auml": "ä",
  "&auml;": "ä",
  "&awconint;": "∳",
  "&awint;": "⨑",
  "&bNot;": "⫭",
  "&backcong;": "≌",
  "&backepsilon;": "϶",
  "&backprime;": "‵",
  "&backsim;": "∽",
  "&backsimeq;": "⋍",
  "&barvee;": "⊽",
  "&barwed;": "⌅",
  "&barwedge;": "⌅",
  "&bbrk;": "⎵",
  "&bbrktbrk;": "⎶",
  "&bcong;": "≌",
  "&bcy;": "б",
  "&bdquo;": "„",
  "&becaus;": "∵",
  "&because;": "∵",
  "&bemptyv;": "⦰",
  "&bepsi;": "϶",
  "&bernou;": "ℬ",
  "&beta;": "β",
  "&beth;": "ℶ",
  "&between;": "≬",
  "&bfr;": "𝔟",
  "&bigcap;": "⋂",
  "&bigcirc;": "◯",
  "&bigcup;": "⋃",
  "&bigodot;": "⨀",
  "&bigoplus;": "⨁",
  "&bigotimes;": "⨂",
  "&bigsqcup;": "⨆",
  "&bigstar;": "★",
  "&bigtriangledown;": "▽",
  "&bigtriangleup;": "△",
  "&biguplus;": "⨄",
  "&bigvee;": "⋁",
  "&bigwedge;": "⋀",
  "&bkarow;": "⤍",
  "&blacklozenge;": "⧫",
  "&blacksquare;": "▪",
  "&blacktriangle;": "▴",
  "&blacktriangledown;": "▾",
  "&blacktriangleleft;": "◂",
  "&blacktriangleright;": "▸",
  "&blank;": "␣",
  "&blk12;": "▒",
  "&blk14;": "░",
  "&blk34;": "▓",
  "&block;": "█",
  "&bne;": "=⃥",
  "&bnequiv;": "≡⃥",
  "&bnot;": "⌐",
  "&bopf;": "𝕓",
  "&bot;": "⊥",
  "&bottom;": "⊥",
  "&bowtie;": "⋈",
  "&boxDL;": "╗",
  "&boxDR;": "╔",
  "&boxDl;": "╖",
  "&boxDr;": "╓",
  "&boxH;": "═",
  "&boxHD;": "╦",
  "&boxHU;": "╩",
  "&boxHd;": "╤",
  "&boxHu;": "╧",
  "&boxUL;": "╝",
  "&boxUR;": "╚",
  "&boxUl;": "╜",
  "&boxUr;": "╙",
  "&boxV;": "║",
  "&boxVH;": "╬",
  "&boxVL;": "╣",
  "&boxVR;": "╠",
  "&boxVh;": "╫",
  "&boxVl;": "╢",
  "&boxVr;": "╟",
  "&boxbox;": "⧉",
  "&boxdL;": "╕",
  "&boxdR;": "╒",
  "&boxdl;": "┐",
  "&boxdr;": "┌",
  "&boxh;": "─",
  "&boxhD;": "╥",
  "&boxhU;": "╨",
  "&boxhd;": "┬",
  "&boxhu;": "┴",
  "&boxminus;": "⊟",
  "&boxplus;": "⊞",
  "&boxtimes;": "⊠",
  "&boxuL;": "╛",
  "&boxuR;": "╘",
  "&boxul;": "┘",
  "&boxur;": "└",
  "&boxv;": "│",
  "&boxvH;": "╪",
  "&boxvL;": "╡",
  "&boxvR;": "╞",
  "&boxvh;": "┼",
  "&boxvl;": "┤",
  "&boxvr;": "├",
  "&bprime;": "‵",
  "&breve;": "˘",
  "&brvbar": "¦",
  "&brvbar;": "¦",
  "&bscr;": "𝒷",
  "&bsemi;": "⁏",
  "&bsim;": "∽",
  "&bsime;": "⋍",
  "&bsol;": "\\",
  "&bsolb;": "⧅",
  "&bsolhsub;": "⟈",
  "&bull;": "•",
  "&bullet;": "•",
  "&bump;": "≎",
  "&bumpE;": "⪮",
  "&bumpe;": "≏",
  "&bumpeq;": "≏",
  "&cacute;": "ć",
  "&cap;": "∩",
  "&capand;": "⩄",
  "&capbrcup;": "⩉",
  "&capcap;": "⩋",
  "&capcup;": "⩇",
  "&capdot;": "⩀",
  "&caps;": "∩︀",
  "&caret;": "⁁",
  "&caron;": "ˇ",
  "&ccaps;": "⩍",
  "&ccaron;": "č",
  "&ccedil": "ç",
  "&ccedil;": "ç",
  "&ccirc;": "ĉ",
  "&ccups;": "⩌",
  "&ccupssm;": "⩐",
  "&cdot;": "ċ",
  "&cedil": "¸",
  "&cedil;": "¸",
  "&cemptyv;": "⦲",
  "&cent": "¢",
  "&cent;": "¢",
  "&centerdot;": "·",
  "&cfr;": "𝔠",
  "&chcy;": "ч",
  "&check;": "✓",
  "&checkmark;": "✓",
  "&chi;": "χ",
  "&cir;": "○",
  "&cirE;": "⧃",
  "&circ;": "ˆ",
  "&circeq;": "≗",
  "&circlearrowleft;": "↺",
  "&circlearrowright;": "↻",
  "&circledR;": "®",
  "&circledS;": "Ⓢ",
  "&circledast;": "⊛",
  "&circledcirc;": "⊚",
  "&circleddash;": "⊝",
  "&cire;": "≗",
  "&cirfnint;": "⨐",
  "&cirmid;": "⫯",
  "&cirscir;": "⧂",
  "&clubs;": "♣",
  "&clubsuit;": "♣",
  "&colon;": ":",
  "&colone;": "≔",
  "&coloneq;": "≔",
  "&comma;": ",",
  "&commat;": "@",
  "&comp;": "∁",
  "&compfn;": "∘",
  "&complement;": "∁",
  "&complexes;": "ℂ",
  "&cong;": "≅",
  "&congdot;": "⩭",
  "&conint;": "∮",
  "&copf;": "𝕔",
  "&coprod;": "∐",
  "&copy": "©",
  "&copy;": "©",
  "&copysr;": "℗",
  "&crarr;": "↵",
  "&cross;": "✗",
  "&cscr;": "𝒸",
  "&csub;": "⫏",
  "&csube;": "⫑",
  "&csup;": "⫐",
  "&csupe;": "⫒",
  "&ctdot;": "⋯",
  "&cudarrl;": "⤸",
  "&cudarrr;": "⤵",
  "&cuepr;": "⋞",
  "&cuesc;": "⋟",
  "&cularr;": "↶",
  "&cularrp;": "⤽",
  "&cup;": "∪",
  "&cupbrcap;": "⩈",
  "&cupcap;": "⩆",
  "&cupcup;": "⩊",
  "&cupdot;": "⊍",
  "&cupor;": "⩅",
  "&cups;": "∪︀",
  "&curarr;": "↷",
  "&curarrm;": "⤼",
  "&curlyeqprec;": "⋞",
  "&curlyeqsucc;": "⋟",
  "&curlyvee;": "⋎",
  "&curlywedge;": "⋏",
  "&curren": "¤",
  "&curren;": "¤",
  "&curvearrowleft;": "↶",
  "&curvearrowright;": "↷",
  "&cuvee;": "⋎",
  "&cuwed;": "⋏",
  "&cwconint;": "∲",
  "&cwint;": "∱",
  "&cylcty;": "⌭",
  "&dArr;": "⇓",
  "&dHar;": "⥥",
  "&dagger;": "†",
  "&daleth;": "ℸ",
  "&darr;": "↓",
  "&dash;": "‐",
  "&dashv;": "⊣",
  "&dbkarow;": "⤏",
  "&dblac;": "˝",
  "&dcaron;": "ď",
  "&dcy;": "д",
  "&dd;": "ⅆ",
  "&ddagger;": "‡",
  "&ddarr;": "⇊",
  "&ddotseq;": "⩷",
  "&deg": "°",
  "&deg;": "°",
  "&delta;": "δ",
  "&demptyv;": "⦱",
  "&dfisht;": "⥿",
  "&dfr;": "𝔡",
  "&dharl;": "⇃",
  "&dharr;": "⇂",
  "&diam;": "⋄",
  "&diamond;": "⋄",
  "&diamondsuit;": "♦",
  "&diams;": "♦",
  "&die;": "¨",
  "&digamma;": "ϝ",
  "&disin;": "⋲",
  "&div;": "÷",
  "&divide": "÷",
  "&divide;": "÷",
  "&divideontimes;": "⋇",
  "&divonx;": "⋇",
  "&djcy;": "ђ",
  "&dlcorn;": "⌞",
  "&dlcrop;": "⌍",
  "&dollar;": "$",
  "&dopf;": "𝕕",
  "&dot;": "˙",
  "&doteq;": "≐",
  "&doteqdot;": "≑",
  "&dotminus;": "∸",
  "&dotplus;": "∔",
  "&dotsquare;": "⊡",
  "&doublebarwedge;": "⌆",
  "&downarrow;": "↓",
  "&downdownarrows;": "⇊",
  "&downharpoonleft;": "⇃",
  "&downharpoonright;": "⇂",
  "&drbkarow;": "⤐",
  "&drcorn;": "⌟",
  "&drcrop;": "⌌",
  "&dscr;": "𝒹",
  "&dscy;": "ѕ",
  "&dsol;": "⧶",
  "&dstrok;": "đ",
  "&dtdot;": "⋱",
  "&dtri;": "▿",
  "&dtrif;": "▾",
  "&duarr;": "⇵",
  "&duhar;": "⥯",
  "&dwangle;": "⦦",
  "&dzcy;": "џ",
  "&dzigrarr;": "⟿",
  "&eDDot;": "⩷",
  "&eDot;": "≑",
  "&eacute": "é",
  "&eacute;": "é",
  "&easter;": "⩮",
  "&ecaron;": "ě",
  "&ecir;": "≖",
  "&ecirc": "ê",
  "&ecirc;": "ê",
  "&ecolon;": "≕",
  "&ecy;": "э",
  "&edot;": "ė",
  "&ee;": "ⅇ",
  "&efDot;": "≒",
  "&efr;": "𝔢",
  "&eg;": "⪚",
  "&egrave": "è",
  "&egrave;": "è",
  "&egs;": "⪖",
  "&egsdot;": "⪘",
  "&el;": "⪙",
  "&elinters;": "⏧",
  "&ell;": "ℓ",
  "&els;": "⪕",
  "&elsdot;": "⪗",
  "&emacr;": "ē",
  "&empty;": "∅",
  "&emptyset;": "∅",
  "&emptyv;": "∅",
  "&emsp13;": " ",
  "&emsp14;": " ",
  "&emsp;": " ",
  "&eng;": "ŋ",
  "&ensp;": " ",
  "&eogon;": "ę",
  "&eopf;": "𝕖",
  "&epar;": "⋕",
  "&eparsl;": "⧣",
  "&eplus;": "⩱",
  "&epsi;": "ε",
  "&epsilon;": "ε",
  "&epsiv;": "ϵ",
  "&eqcirc;": "≖",
  "&eqcolon;": "≕",
  "&eqsim;": "≂",
  "&eqslantgtr;": "⪖",
  "&eqslantless;": "⪕",
  "&equals;": "=",
  "&equest;": "≟",
  "&equiv;": "≡",
  "&equivDD;": "⩸",
  "&eqvparsl;": "⧥",
  "&erDot;": "≓",
  "&erarr;": "⥱",
  "&escr;": "ℯ",
  "&esdot;": "≐",
  "&esim;": "≂",
  "&eta;": "η",
  "&eth": "ð",
  "&eth;": "ð",
  "&euml": "ë",
  "&euml;": "ë",
  "&euro;": "€",
  "&excl;": "!",
  "&exist;": "∃",
  "&expectation;": "ℰ",
  "&exponentiale;": "ⅇ",
  "&fallingdotseq;": "≒",
  "&fcy;": "ф",
  "&female;": "♀",
  "&ffilig;": "ﬃ",
  "&fflig;": "ﬀ",
  "&ffllig;": "ﬄ",
  "&ffr;": "𝔣",
  "&filig;": "ﬁ",
  "&fjlig;": "fj",
  "&flat;": "♭",
  "&fllig;": "ﬂ",
  "&fltns;": "▱",
  "&fnof;": "ƒ",
  "&fopf;": "𝕗",
  "&forall;": "∀",
  "&fork;": "⋔",
  "&forkv;": "⫙",
  "&fpartint;": "⨍",
  "&frac12": "½",
  "&frac12;": "½",
  "&frac13;": "⅓",
  "&frac14": "¼",
  "&frac14;": "¼",
  "&frac15;": "⅕",
  "&frac16;": "⅙",
  "&frac18;": "⅛",
  "&frac23;": "⅔",
  "&frac25;": "⅖",
  "&frac34": "¾",
  "&frac34;": "¾",
  "&frac35;": "⅗",
  "&frac38;": "⅜",
  "&frac45;": "⅘",
  "&frac56;": "⅚",
  "&frac58;": "⅝",
  "&frac78;": "⅞",
  "&frasl;": "⁄",
  "&frown;": "⌢",
  "&fscr;": "𝒻",
  "&gE;": "≧",
  "&gEl;": "⪌",
  "&gacute;": "ǵ",
  "&gamma;": "γ",
  "&gammad;": "ϝ",
  "&gap;": "⪆",
  "&gbreve;": "ğ",
  "&gcirc;": "ĝ",
  "&gcy;": "г",
  "&gdot;": "ġ",
  "&ge;": "≥",
  "&gel;": "⋛",
  "&geq;": "≥",
  "&geqq;": "≧",
  "&geqslant;": "⩾",
  "&ges;": "⩾",
  "&gescc;": "⪩",
  "&gesdot;": "⪀",
  "&gesdoto;": "⪂",
  "&gesdotol;": "⪄",
  "&gesl;": "⋛︀",
  "&gesles;": "⪔",
  "&gfr;": "𝔤",
  "&gg;": "≫",
  "&ggg;": "⋙",
  "&gimel;": "ℷ",
  "&gjcy;": "ѓ",
  "&gl;": "≷",
  "&glE;": "⪒",
  "&gla;": "⪥",
  "&glj;": "⪤",
  "&gnE;": "≩",
  "&gnap;": "⪊",
  "&gnapprox;": "⪊",
  "&gne;": "⪈",
  "&gneq;": "⪈",
  "&gneqq;": "≩",
  "&gnsim;": "⋧",
  "&gopf;": "𝕘",
  "&grave;": "`",
  "&gscr;": "ℊ",
  "&gsim;": "≳",
  "&gsime;": "⪎",
  "&gsiml;": "⪐",
  "&gt": ">",
  "&gt;": ">",
  "&gtcc;": "⪧",
  "&gtcir;": "⩺",
  "&gtdot;": "⋗",
  "&gtlPar;": "⦕",
  "&gtquest;": "⩼",
  "&gtrapprox;": "⪆",
  "&gtrarr;": "⥸",
  "&gtrdot;": "⋗",
  "&gtreqless;": "⋛",
  "&gtreqqless;": "⪌",
  "&gtrless;": "≷",
  "&gtrsim;": "≳",
  "&gvertneqq;": "≩︀",
  "&gvnE;": "≩︀",
  "&hArr;": "⇔",
  "&hairsp;": " ",
  "&half;": "½",
  "&hamilt;": "ℋ",
  "&hardcy;": "ъ",
  "&harr;": "↔",
  "&harrcir;": "⥈",
  "&harrw;": "↭",
  "&hbar;": "ℏ",
  "&hcirc;": "ĥ",
  "&hearts;": "♥",
  "&heartsuit;": "♥",
  "&hellip;": "…",
  "&hercon;": "⊹",
  "&hfr;": "𝔥",
  "&hksearow;": "⤥",
  "&hkswarow;": "⤦",
  "&hoarr;": "⇿",
  "&homtht;": "∻",
  "&hookleftarrow;": "↩",
  "&hookrightarrow;": "↪",
  "&hopf;": "𝕙",
  "&horbar;": "―",
  "&hscr;": "𝒽",
  "&hslash;": "ℏ",
  "&hstrok;": "ħ",
  "&hybull;": "⁃",
  "&hyphen;": "‐",
  "&iacute": "í",
  "&iacute;": "í",
  "&ic;": "⁣",
  "&icirc": "î",
  "&icirc;": "î",
  "&icy;": "и",
  "&iecy;": "е",
  "&iexcl": "¡",
  "&iexcl;": "¡",
  "&iff;": "⇔",
  "&ifr;": "𝔦",
  "&igrave": "ì",
  "&igrave;": "ì",
  "&ii;": "ⅈ",
  "&iiiint;": "⨌",
  "&iiint;": "∭",
  "&iinfin;": "⧜",
  "&iiota;": "℩",
  "&ijlig;": "ĳ",
  "&imacr;": "ī",
  "&image;": "ℑ",
  "&imagline;": "ℐ",
  "&imagpart;": "ℑ",
  "&imath;": "ı",
  "&imof;": "⊷",
  "&imped;": "Ƶ",
  "&in;": "∈",
  "&incare;": "℅",
  "&infin;": "∞",
  "&infintie;": "⧝",
  "&inodot;": "ı",
  "&int;": "∫",
  "&intcal;": "⊺",
  "&integers;": "ℤ",
  "&intercal;": "⊺",
  "&intlarhk;": "⨗",
  "&intprod;": "⨼",
  "&iocy;": "ё",
  "&iogon;": "į",
  "&iopf;": "𝕚",
  "&iota;": "ι",
  "&iprod;": "⨼",
  "&iquest": "¿",
  "&iquest;": "¿",
  "&iscr;": "𝒾",
  "&isin;": "∈",
  "&isinE;": "⋹",
  "&isindot;": "⋵",
  "&isins;": "⋴",
  "&isinsv;": "⋳",
  "&isinv;": "∈",
  "&it;": "⁢",
  "&itilde;": "ĩ",
  "&iukcy;": "і",
  "&iuml": "ï",
  "&iuml;": "ï",
  "&jcirc;": "ĵ",
  "&jcy;": "й",
  "&jfr;": "𝔧",
  "&jmath;": "ȷ",
  "&jopf;": "𝕛",
  "&jscr;": "𝒿",
  "&jsercy;": "ј",
  "&jukcy;": "є",
  "&kappa;": "κ",
  "&kappav;": "ϰ",
  "&kcedil;": "ķ",
  "&kcy;": "к",
  "&kfr;": "𝔨",
  "&kgreen;": "ĸ",
  "&khcy;": "х",
  "&kjcy;": "ќ",
  "&kopf;": "𝕜",
  "&kscr;": "𝓀",
  "&lAarr;": "⇚",
  "&lArr;": "⇐",
  "&lAtail;": "⤛",
  "&lBarr;": "⤎",
  "&lE;": "≦",
  "&lEg;": "⪋",
  "&lHar;": "⥢",
  "&lacute;": "ĺ",
  "&laemptyv;": "⦴",
  "&lagran;": "ℒ",
  "&lambda;": "λ",
  "&lang;": "⟨",
  "&langd;": "⦑",
  "&langle;": "⟨",
  "&lap;": "⪅",
  "&laquo": "«",
  "&laquo;": "«",
  "&larr;": "←",
  "&larrb;": "⇤",
  "&larrbfs;": "⤟",
  "&larrfs;": "⤝",
  "&larrhk;": "↩",
  "&larrlp;": "↫",
  "&larrpl;": "⤹",
  "&larrsim;": "⥳",
  "&larrtl;": "↢",
  "&lat;": "⪫",
  "&latail;": "⤙",
  "&late;": "⪭",
  "&lates;": "⪭︀",
  "&lbarr;": "⤌",
  "&lbbrk;": "❲",
  "&lbrace;": "{",
  "&lbrack;": "[",
  "&lbrke;": "⦋",
  "&lbrksld;": "⦏",
  "&lbrkslu;": "⦍",
  "&lcaron;": "ľ",
  "&lcedil;": "ļ",
  "&lceil;": "⌈",
  "&lcub;": "{",
  "&lcy;": "л",
  "&ldca;": "⤶",
  "&ldquo;": "“",
  "&ldquor;": "„",
  "&ldrdhar;": "⥧",
  "&ldrushar;": "⥋",
  "&ldsh;": "↲",
  "&le;": "≤",
  "&leftarrow;": "←",
  "&leftarrowtail;": "↢",
  "&leftharpoondown;": "↽",
  "&leftharpoonup;": "↼",
  "&leftleftarrows;": "⇇",
  "&leftrightarrow;": "↔",
  "&leftrightarrows;": "⇆",
  "&leftrightharpoons;": "⇋",
  "&leftrightsquigarrow;": "↭",
  "&leftthreetimes;": "⋋",
  "&leg;": "⋚",
  "&leq;": "≤",
  "&leqq;": "≦",
  "&leqslant;": "⩽",
  "&les;": "⩽",
  "&lescc;": "⪨",
  "&lesdot;": "⩿",
  "&lesdoto;": "⪁",
  "&lesdotor;": "⪃",
  "&lesg;": "⋚︀",
  "&lesges;": "⪓",
  "&lessapprox;": "⪅",
  "&lessdot;": "⋖",
  "&lesseqgtr;": "⋚",
  "&lesseqqgtr;": "⪋",
  "&lessgtr;": "≶",
  "&lesssim;": "≲",
  "&lfisht;": "⥼",
  "&lfloor;": "⌊",
  "&lfr;": "𝔩",
  "&lg;": "≶",
  "&lgE;": "⪑",
  "&lhard;": "↽",
  "&lharu;": "↼",
  "&lharul;": "⥪",
  "&lhblk;": "▄",
  "&ljcy;": "љ",
  "&ll;": "≪",
  "&llarr;": "⇇",
  "&llcorner;": "⌞",
  "&llhard;": "⥫",
  "&lltri;": "◺",
  "&lmidot;": "ŀ",
  "&lmoust;": "⎰",
  "&lmoustache;": "⎰",
  "&lnE;": "≨",
  "&lnap;": "⪉",
  "&lnapprox;": "⪉",
  "&lne;": "⪇",
  "&lneq;": "⪇",
  "&lneqq;": "≨",
  "&lnsim;": "⋦",
  "&loang;": "⟬",
  "&loarr;": "⇽",
  "&lobrk;": "⟦",
  "&longleftarrow;": "⟵",
  "&longleftrightarrow;": "⟷",
  "&longmapsto;": "⟼",
  "&longrightarrow;": "⟶",
  "&looparrowleft;": "↫",
  "&looparrowright;": "↬",
  "&lopar;": "⦅",
  "&lopf;": "𝕝",
  "&loplus;": "⨭",
  "&lotimes;": "⨴",
  "&lowast;": "∗",
  "&lowbar;": "_",
  "&loz;": "◊",
  "&lozenge;": "◊",
  "&lozf;": "⧫",
  "&lpar;": "(",
  "&lparlt;": "⦓",
  "&lrarr;": "⇆",
  "&lrcorner;": "⌟",
  "&lrhar;": "⇋",
  "&lrhard;": "⥭",
  "&lrm;": "‎",
  "&lrtri;": "⊿",
  "&lsaquo;": "‹",
  "&lscr;": "𝓁",
  "&lsh;": "↰",
  "&lsim;": "≲",
  "&lsime;": "⪍",
  "&lsimg;": "⪏",
  "&lsqb;": "[",
  "&lsquo;": "‘",
  "&lsquor;": "‚",
  "&lstrok;": "ł",
  "&lt": "<",
  "&lt;": "<",
  "&ltcc;": "⪦",
  "&ltcir;": "⩹",
  "&ltdot;": "⋖",
  "&lthree;": "⋋",
  "&ltimes;": "⋉",
  "&ltlarr;": "⥶",
  "&ltquest;": "⩻",
  "&ltrPar;": "⦖",
  "&ltri;": "◃",
  "&ltrie;": "⊴",
  "&ltrif;": "◂",
  "&lurdshar;": "⥊",
  "&luruhar;": "⥦",
  "&lvertneqq;": "≨︀",
  "&lvnE;": "≨︀",
  "&mDDot;": "∺",
  "&macr": "¯",
  "&macr;": "¯",
  "&male;": "♂",
  "&malt;": "✠",
  "&maltese;": "✠",
  "&map;": "↦",
  "&mapsto;": "↦",
  "&mapstodown;": "↧",
  "&mapstoleft;": "↤",
  "&mapstoup;": "↥",
  "&marker;": "▮",
  "&mcomma;": "⨩",
  "&mcy;": "м",
  "&mdash;": "—",
  "&measuredangle;": "∡",
  "&mfr;": "𝔪",
  "&mho;": "℧",
  "&micro": "µ",
  "&micro;": "µ",
  "&mid;": "∣",
  "&midast;": "*",
  "&midcir;": "⫰",
  "&middot": "·",
  "&middot;": "·",
  "&minus;": "−",
  "&minusb;": "⊟",
  "&minusd;": "∸",
  "&minusdu;": "⨪",
  "&mlcp;": "⫛",
  "&mldr;": "…",
  "&mnplus;": "∓",
  "&models;": "⊧",
  "&mopf;": "𝕞",
  "&mp;": "∓",
  "&mscr;": "𝓂",
  "&mstpos;": "∾",
  "&mu;": "μ",
  "&multimap;": "⊸",
  "&mumap;": "⊸",
  "&nGg;": "⋙̸",
  "&nGt;": "≫⃒",
  "&nGtv;": "≫̸",
  "&nLeftarrow;": "⇍",
  "&nLeftrightarrow;": "⇎",
  "&nLl;": "⋘̸",
  "&nLt;": "≪⃒",
  "&nLtv;": "≪̸",
  "&nRightarrow;": "⇏",
  "&nVDash;": "⊯",
  "&nVdash;": "⊮",
  "&nabla;": "∇",
  "&nacute;": "ń",
  "&nang;": "∠⃒",
  "&nap;": "≉",
  "&napE;": "⩰̸",
  "&napid;": "≋̸",
  "&napos;": "ŉ",
  "&napprox;": "≉",
  "&natur;": "♮",
  "&natural;": "♮",
  "&naturals;": "ℕ",
  "&nbsp": " ",
  "&nbsp;": " ",
  "&nbump;": "≎̸",
  "&nbumpe;": "≏̸",
  "&ncap;": "⩃",
  "&ncaron;": "ň",
  "&ncedil;": "ņ",
  "&ncong;": "≇",
  "&ncongdot;": "⩭̸",
  "&ncup;": "⩂",
  "&ncy;": "н",
  "&ndash;": "–",
  "&ne;": "≠",
  "&neArr;": "⇗",
  "&nearhk;": "⤤",
  "&nearr;": "↗",
  "&nearrow;": "↗",
  "&nedot;": "≐̸",
  "&nequiv;": "≢",
  "&nesear;": "⤨",
  "&nesim;": "≂̸",
  "&nexist;": "∄",
  "&nexists;": "∄",
  "&nfr;": "𝔫",
  "&ngE;": "≧̸",
  "&nge;": "≱",
  "&ngeq;": "≱",
  "&ngeqq;": "≧̸",
  "&ngeqslant;": "⩾̸",
  "&nges;": "⩾̸",
  "&ngsim;": "≵",
  "&ngt;": "≯",
  "&ngtr;": "≯",
  "&nhArr;": "⇎",
  "&nharr;": "↮",
  "&nhpar;": "⫲",
  "&ni;": "∋",
  "&nis;": "⋼",
  "&nisd;": "⋺",
  "&niv;": "∋",
  "&njcy;": "њ",
  "&nlArr;": "⇍",
  "&nlE;": "≦̸",
  "&nlarr;": "↚",
  "&nldr;": "‥",
  "&nle;": "≰",
  "&nleftarrow;": "↚",
  "&nleftrightarrow;": "↮",
  "&nleq;": "≰",
  "&nleqq;": "≦̸",
  "&nleqslant;": "⩽̸",
  "&nles;": "⩽̸",
  "&nless;": "≮",
  "&nlsim;": "≴",
  "&nlt;": "≮",
  "&nltri;": "⋪",
  "&nltrie;": "⋬",
  "&nmid;": "∤",
  "&nopf;": "𝕟",
  "&not": "¬",
  "&not;": "¬",
  "&notin;": "∉",
  "&notinE;": "⋹̸",
  "&notindot;": "⋵̸",
  "&notinva;": "∉",
  "&notinvb;": "⋷",
  "&notinvc;": "⋶",
  "&notni;": "∌",
  "&notniva;": "∌",
  "&notnivb;": "⋾",
  "&notnivc;": "⋽",
  "&npar;": "∦",
  "&nparallel;": "∦",
  "&nparsl;": "⫽⃥",
  "&npart;": "∂̸",
  "&npolint;": "⨔",
  "&npr;": "⊀",
  "&nprcue;": "⋠",
  "&npre;": "⪯̸",
  "&nprec;": "⊀",
  "&npreceq;": "⪯̸",
  "&nrArr;": "⇏",
  "&nrarr;": "↛",
  "&nrarrc;": "⤳̸",
  "&nrarrw;": "↝̸",
  "&nrightarrow;": "↛",
  "&nrtri;": "⋫",
  "&nrtrie;": "⋭",
  "&nsc;": "⊁",
  "&nsccue;": "⋡",
  "&nsce;": "⪰̸",
  "&nscr;": "𝓃",
  "&nshortmid;": "∤",
  "&nshortparallel;": "∦",
  "&nsim;": "≁",
  "&nsime;": "≄",
  "&nsimeq;": "≄",
  "&nsmid;": "∤",
  "&nspar;": "∦",
  "&nsqsube;": "⋢",
  "&nsqsupe;": "⋣",
  "&nsub;": "⊄",
  "&nsubE;": "⫅̸",
  "&nsube;": "⊈",
  "&nsubset;": "⊂⃒",
  "&nsubseteq;": "⊈",
  "&nsubseteqq;": "⫅̸",
  "&nsucc;": "⊁",
  "&nsucceq;": "⪰̸",
  "&nsup;": "⊅",
  "&nsupE;": "⫆̸",
  "&nsupe;": "⊉",
  "&nsupset;": "⊃⃒",
  "&nsupseteq;": "⊉",
  "&nsupseteqq;": "⫆̸",
  "&ntgl;": "≹",
  "&ntilde": "ñ",
  "&ntilde;": "ñ",
  "&ntlg;": "≸",
  "&ntriangleleft;": "⋪",
  "&ntrianglelefteq;": "⋬",
  "&ntriangleright;": "⋫",
  "&ntrianglerighteq;": "⋭",
  "&nu;": "ν",
  "&num;": "#",
  "&numero;": "№",
  "&numsp;": " ",
  "&nvDash;": "⊭",
  "&nvHarr;": "⤄",
  "&nvap;": "≍⃒",
  "&nvdash;": "⊬",
  "&nvge;": "≥⃒",
  "&nvgt;": ">⃒",
  "&nvinfin;": "⧞",
  "&nvlArr;": "⤂",
  "&nvle;": "≤⃒",
  "&nvlt;": "<⃒",
  "&nvltrie;": "⊴⃒",
  "&nvrArr;": "⤃",
  "&nvrtrie;": "⊵⃒",
  "&nvsim;": "∼⃒",
  "&nwArr;": "⇖",
  "&nwarhk;": "⤣",
  "&nwarr;": "↖",
  "&nwarrow;": "↖",
  "&nwnear;": "⤧",
  "&oS;": "Ⓢ",
  "&oacute": "ó",
  "&oacute;": "ó",
  "&oast;": "⊛",
  "&ocir;": "⊚",
  "&ocirc": "ô",
  "&ocirc;": "ô",
  "&ocy;": "о",
  "&odash;": "⊝",
  "&odblac;": "ő",
  "&odiv;": "⨸",
  "&odot;": "⊙",
  "&odsold;": "⦼",
  "&oelig;": "œ",
  "&ofcir;": "⦿",
  "&ofr;": "𝔬",
  "&ogon;": "˛",
  "&ograve": "ò",
  "&ograve;": "ò",
  "&ogt;": "⧁",
  "&ohbar;": "⦵",
  "&ohm;": "Ω",
  "&oint;": "∮",
  "&olarr;": "↺",
  "&olcir;": "⦾",
  "&olcross;": "⦻",
  "&oline;": "‾",
  "&olt;": "⧀",
  "&omacr;": "ō",
  "&omega;": "ω",
  "&omicron;": "ο",
  "&omid;": "⦶",
  "&ominus;": "⊖",
  "&oopf;": "𝕠",
  "&opar;": "⦷",
  "&operp;": "⦹",
  "&oplus;": "⊕",
  "&or;": "∨",
  "&orarr;": "↻",
  "&ord;": "⩝",
  "&order;": "ℴ",
  "&orderof;": "ℴ",
  "&ordf": "ª",
  "&ordf;": "ª",
  "&ordm": "º",
  "&ordm;": "º",
  "&origof;": "⊶",
  "&oror;": "⩖",
  "&orslope;": "⩗",
  "&orv;": "⩛",
  "&oscr;": "ℴ",
  "&oslash": "ø",
  "&oslash;": "ø",
  "&osol;": "⊘",
  "&otilde": "õ",
  "&otilde;": "õ",
  "&otimes;": "⊗",
  "&otimesas;": "⨶",
  "&ouml": "ö",
  "&ouml;": "ö",
  "&ovbar;": "⌽",
  "&par;": "∥",
  "&para": "¶",
  "&para;": "¶",
  "&parallel;": "∥",
  "&parsim;": "⫳",
  "&parsl;": "⫽",
  "&part;": "∂",
  "&pcy;": "п",
  "&percnt;": "%",
  "&period;": ".",
  "&permil;": "‰",
  "&perp;": "⊥",
  "&pertenk;": "‱",
  "&pfr;": "𝔭",
  "&phi;": "φ",
  "&phiv;": "ϕ",
  "&phmmat;": "ℳ",
  "&phone;": "☎",
  "&pi;": "π",
  "&pitchfork;": "⋔",
  "&piv;": "ϖ",
  "&planck;": "ℏ",
  "&planckh;": "ℎ",
  "&plankv;": "ℏ",
  "&plus;": "+",
  "&plusacir;": "⨣",
  "&plusb;": "⊞",
  "&pluscir;": "⨢",
  "&plusdo;": "∔",
  "&plusdu;": "⨥",
  "&pluse;": "⩲",
  "&plusmn": "±",
  "&plusmn;": "±",
  "&plussim;": "⨦",
  "&plustwo;": "⨧",
  "&pm;": "±",
  "&pointint;": "⨕",
  "&popf;": "𝕡",
  "&pound": "£",
  "&pound;": "£",
  "&pr;": "≺",
  "&prE;": "⪳",
  "&prap;": "⪷",
  "&prcue;": "≼",
  "&pre;": "⪯",
  "&prec;": "≺",
  "&precapprox;": "⪷",
  "&preccurlyeq;": "≼",
  "&preceq;": "⪯",
  "&precnapprox;": "⪹",
  "&precneqq;": "⪵",
  "&precnsim;": "⋨",
  "&precsim;": "≾",
  "&prime;": "′",
  "&primes;": "ℙ",
  "&prnE;": "⪵",
  "&prnap;": "⪹",
  "&prnsim;": "⋨",
  "&prod;": "∏",
  "&profalar;": "⌮",
  "&profline;": "⌒",
  "&profsurf;": "⌓",
  "&prop;": "∝",
  "&propto;": "∝",
  "&prsim;": "≾",
  "&prurel;": "⊰",
  "&pscr;": "𝓅",
  "&psi;": "ψ",
  "&puncsp;": " ",
  "&qfr;": "𝔮",
  "&qint;": "⨌",
  "&qopf;": "𝕢",
  "&qprime;": "⁗",
  "&qscr;": "𝓆",
  "&quaternions;": "ℍ",
  "&quatint;": "⨖",
  "&quest;": "?",
  "&questeq;": "≟",
  "&quot": '"',
  "&quot;": '"',
  "&rAarr;": "⇛",
  "&rArr;": "⇒",
  "&rAtail;": "⤜",
  "&rBarr;": "⤏",
  "&rHar;": "⥤",
  "&race;": "∽̱",
  "&racute;": "ŕ",
  "&radic;": "√",
  "&raemptyv;": "⦳",
  "&rang;": "⟩",
  "&rangd;": "⦒",
  "&range;": "⦥",
  "&rangle;": "⟩",
  "&raquo": "»",
  "&raquo;": "»",
  "&rarr;": "→",
  "&rarrap;": "⥵",
  "&rarrb;": "⇥",
  "&rarrbfs;": "⤠",
  "&rarrc;": "⤳",
  "&rarrfs;": "⤞",
  "&rarrhk;": "↪",
  "&rarrlp;": "↬",
  "&rarrpl;": "⥅",
  "&rarrsim;": "⥴",
  "&rarrtl;": "↣",
  "&rarrw;": "↝",
  "&ratail;": "⤚",
  "&ratio;": "∶",
  "&rationals;": "ℚ",
  "&rbarr;": "⤍",
  "&rbbrk;": "❳",
  "&rbrace;": "}",
  "&rbrack;": "]",
  "&rbrke;": "⦌",
  "&rbrksld;": "⦎",
  "&rbrkslu;": "⦐",
  "&rcaron;": "ř",
  "&rcedil;": "ŗ",
  "&rceil;": "⌉",
  "&rcub;": "}",
  "&rcy;": "р",
  "&rdca;": "⤷",
  "&rdldhar;": "⥩",
  "&rdquo;": "”",
  "&rdquor;": "”",
  "&rdsh;": "↳",
  "&real;": "ℜ",
  "&realine;": "ℛ",
  "&realpart;": "ℜ",
  "&reals;": "ℝ",
  "&rect;": "▭",
  "&reg": "®",
  "&reg;": "®",
  "&rfisht;": "⥽",
  "&rfloor;": "⌋",
  "&rfr;": "𝔯",
  "&rhard;": "⇁",
  "&rharu;": "⇀",
  "&rharul;": "⥬",
  "&rho;": "ρ",
  "&rhov;": "ϱ",
  "&rightarrow;": "→",
  "&rightarrowtail;": "↣",
  "&rightharpoondown;": "⇁",
  "&rightharpoonup;": "⇀",
  "&rightleftarrows;": "⇄",
  "&rightleftharpoons;": "⇌",
  "&rightrightarrows;": "⇉",
  "&rightsquigarrow;": "↝",
  "&rightthreetimes;": "⋌",
  "&ring;": "˚",
  "&risingdotseq;": "≓",
  "&rlarr;": "⇄",
  "&rlhar;": "⇌",
  "&rlm;": "‏",
  "&rmoust;": "⎱",
  "&rmoustache;": "⎱",
  "&rnmid;": "⫮",
  "&roang;": "⟭",
  "&roarr;": "⇾",
  "&robrk;": "⟧",
  "&ropar;": "⦆",
  "&ropf;": "𝕣",
  "&roplus;": "⨮",
  "&rotimes;": "⨵",
  "&rpar;": ")",
  "&rpargt;": "⦔",
  "&rppolint;": "⨒",
  "&rrarr;": "⇉",
  "&rsaquo;": "›",
  "&rscr;": "𝓇",
  "&rsh;": "↱",
  "&rsqb;": "]",
  "&rsquo;": "’",
  "&rsquor;": "’",
  "&rthree;": "⋌",
  "&rtimes;": "⋊",
  "&rtri;": "▹",
  "&rtrie;": "⊵",
  "&rtrif;": "▸",
  "&rtriltri;": "⧎",
  "&ruluhar;": "⥨",
  "&rx;": "℞",
  "&sacute;": "ś",
  "&sbquo;": "‚",
  "&sc;": "≻",
  "&scE;": "⪴",
  "&scap;": "⪸",
  "&scaron;": "š",
  "&sccue;": "≽",
  "&sce;": "⪰",
  "&scedil;": "ş",
  "&scirc;": "ŝ",
  "&scnE;": "⪶",
  "&scnap;": "⪺",
  "&scnsim;": "⋩",
  "&scpolint;": "⨓",
  "&scsim;": "≿",
  "&scy;": "с",
  "&sdot;": "⋅",
  "&sdotb;": "⊡",
  "&sdote;": "⩦",
  "&seArr;": "⇘",
  "&searhk;": "⤥",
  "&searr;": "↘",
  "&searrow;": "↘",
  "&sect": "§",
  "&sect;": "§",
  "&semi;": ";",
  "&seswar;": "⤩",
  "&setminus;": "∖",
  "&setmn;": "∖",
  "&sext;": "✶",
  "&sfr;": "𝔰",
  "&sfrown;": "⌢",
  "&sharp;": "♯",
  "&shchcy;": "щ",
  "&shcy;": "ш",
  "&shortmid;": "∣",
  "&shortparallel;": "∥",
  "&shy": "­",
  "&shy;": "­",
  "&sigma;": "σ",
  "&sigmaf;": "ς",
  "&sigmav;": "ς",
  "&sim;": "∼",
  "&simdot;": "⩪",
  "&sime;": "≃",
  "&simeq;": "≃",
  "&simg;": "⪞",
  "&simgE;": "⪠",
  "&siml;": "⪝",
  "&simlE;": "⪟",
  "&simne;": "≆",
  "&simplus;": "⨤",
  "&simrarr;": "⥲",
  "&slarr;": "←",
  "&smallsetminus;": "∖",
  "&smashp;": "⨳",
  "&smeparsl;": "⧤",
  "&smid;": "∣",
  "&smile;": "⌣",
  "&smt;": "⪪",
  "&smte;": "⪬",
  "&smtes;": "⪬︀",
  "&softcy;": "ь",
  "&sol;": "/",
  "&solb;": "⧄",
  "&solbar;": "⌿",
  "&sopf;": "𝕤",
  "&spades;": "♠",
  "&spadesuit;": "♠",
  "&spar;": "∥",
  "&sqcap;": "⊓",
  "&sqcaps;": "⊓︀",
  "&sqcup;": "⊔",
  "&sqcups;": "⊔︀",
  "&sqsub;": "⊏",
  "&sqsube;": "⊑",
  "&sqsubset;": "⊏",
  "&sqsubseteq;": "⊑",
  "&sqsup;": "⊐",
  "&sqsupe;": "⊒",
  "&sqsupset;": "⊐",
  "&sqsupseteq;": "⊒",
  "&squ;": "□",
  "&square;": "□",
  "&squarf;": "▪",
  "&squf;": "▪",
  "&srarr;": "→",
  "&sscr;": "𝓈",
  "&ssetmn;": "∖",
  "&ssmile;": "⌣",
  "&sstarf;": "⋆",
  "&star;": "☆",
  "&starf;": "★",
  "&straightepsilon;": "ϵ",
  "&straightphi;": "ϕ",
  "&strns;": "¯",
  "&sub;": "⊂",
  "&subE;": "⫅",
  "&subdot;": "⪽",
  "&sube;": "⊆",
  "&subedot;": "⫃",
  "&submult;": "⫁",
  "&subnE;": "⫋",
  "&subne;": "⊊",
  "&subplus;": "⪿",
  "&subrarr;": "⥹",
  "&subset;": "⊂",
  "&subseteq;": "⊆",
  "&subseteqq;": "⫅",
  "&subsetneq;": "⊊",
  "&subsetneqq;": "⫋",
  "&subsim;": "⫇",
  "&subsub;": "⫕",
  "&subsup;": "⫓",
  "&succ;": "≻",
  "&succapprox;": "⪸",
  "&succcurlyeq;": "≽",
  "&succeq;": "⪰",
  "&succnapprox;": "⪺",
  "&succneqq;": "⪶",
  "&succnsim;": "⋩",
  "&succsim;": "≿",
  "&sum;": "∑",
  "&sung;": "♪",
  "&sup1": "¹",
  "&sup1;": "¹",
  "&sup2": "²",
  "&sup2;": "²",
  "&sup3": "³",
  "&sup3;": "³",
  "&sup;": "⊃",
  "&supE;": "⫆",
  "&supdot;": "⪾",
  "&supdsub;": "⫘",
  "&supe;": "⊇",
  "&supedot;": "⫄",
  "&suphsol;": "⟉",
  "&suphsub;": "⫗",
  "&suplarr;": "⥻",
  "&supmult;": "⫂",
  "&supnE;": "⫌",
  "&supne;": "⊋",
  "&supplus;": "⫀",
  "&supset;": "⊃",
  "&supseteq;": "⊇",
  "&supseteqq;": "⫆",
  "&supsetneq;": "⊋",
  "&supsetneqq;": "⫌",
  "&supsim;": "⫈",
  "&supsub;": "⫔",
  "&supsup;": "⫖",
  "&swArr;": "⇙",
  "&swarhk;": "⤦",
  "&swarr;": "↙",
  "&swarrow;": "↙",
  "&swnwar;": "⤪",
  "&szlig": "ß",
  "&szlig;": "ß",
  "&target;": "⌖",
  "&tau;": "τ",
  "&tbrk;": "⎴",
  "&tcaron;": "ť",
  "&tcedil;": "ţ",
  "&tcy;": "т",
  "&tdot;": "⃛",
  "&telrec;": "⌕",
  "&tfr;": "𝔱",
  "&there4;": "∴",
  "&therefore;": "∴",
  "&theta;": "θ",
  "&thetasym;": "ϑ",
  "&thetav;": "ϑ",
  "&thickapprox;": "≈",
  "&thicksim;": "∼",
  "&thinsp;": " ",
  "&thkap;": "≈",
  "&thksim;": "∼",
  "&thorn": "þ",
  "&thorn;": "þ",
  "&tilde;": "˜",
  "&times": "×",
  "&times;": "×",
  "&timesb;": "⊠",
  "&timesbar;": "⨱",
  "&timesd;": "⨰",
  "&tint;": "∭",
  "&toea;": "⤨",
  "&top;": "⊤",
  "&topbot;": "⌶",
  "&topcir;": "⫱",
  "&topf;": "𝕥",
  "&topfork;": "⫚",
  "&tosa;": "⤩",
  "&tprime;": "‴",
  "&trade;": "™",
  "&triangle;": "▵",
  "&triangledown;": "▿",
  "&triangleleft;": "◃",
  "&trianglelefteq;": "⊴",
  "&triangleq;": "≜",
  "&triangleright;": "▹",
  "&trianglerighteq;": "⊵",
  "&tridot;": "◬",
  "&trie;": "≜",
  "&triminus;": "⨺",
  "&triplus;": "⨹",
  "&trisb;": "⧍",
  "&tritime;": "⨻",
  "&trpezium;": "⏢",
  "&tscr;": "𝓉",
  "&tscy;": "ц",
  "&tshcy;": "ћ",
  "&tstrok;": "ŧ",
  "&twixt;": "≬",
  "&twoheadleftarrow;": "↞",
  "&twoheadrightarrow;": "↠",
  "&uArr;": "⇑",
  "&uHar;": "⥣",
  "&uacute": "ú",
  "&uacute;": "ú",
  "&uarr;": "↑",
  "&ubrcy;": "ў",
  "&ubreve;": "ŭ",
  "&ucirc": "û",
  "&ucirc;": "û",
  "&ucy;": "у",
  "&udarr;": "⇅",
  "&udblac;": "ű",
  "&udhar;": "⥮",
  "&ufisht;": "⥾",
  "&ufr;": "𝔲",
  "&ugrave": "ù",
  "&ugrave;": "ù",
  "&uharl;": "↿",
  "&uharr;": "↾",
  "&uhblk;": "▀",
  "&ulcorn;": "⌜",
  "&ulcorner;": "⌜",
  "&ulcrop;": "⌏",
  "&ultri;": "◸",
  "&umacr;": "ū",
  "&uml": "¨",
  "&uml;": "¨",
  "&uogon;": "ų",
  "&uopf;": "𝕦",
  "&uparrow;": "↑",
  "&updownarrow;": "↕",
  "&upharpoonleft;": "↿",
  "&upharpoonright;": "↾",
  "&uplus;": "⊎",
  "&upsi;": "υ",
  "&upsih;": "ϒ",
  "&upsilon;": "υ",
  "&upuparrows;": "⇈",
  "&urcorn;": "⌝",
  "&urcorner;": "⌝",
  "&urcrop;": "⌎",
  "&uring;": "ů",
  "&urtri;": "◹",
  "&uscr;": "𝓊",
  "&utdot;": "⋰",
  "&utilde;": "ũ",
  "&utri;": "▵",
  "&utrif;": "▴",
  "&uuarr;": "⇈",
  "&uuml": "ü",
  "&uuml;": "ü",
  "&uwangle;": "⦧",
  "&vArr;": "⇕",
  "&vBar;": "⫨",
  "&vBarv;": "⫩",
  "&vDash;": "⊨",
  "&vangrt;": "⦜",
  "&varepsilon;": "ϵ",
  "&varkappa;": "ϰ",
  "&varnothing;": "∅",
  "&varphi;": "ϕ",
  "&varpi;": "ϖ",
  "&varpropto;": "∝",
  "&varr;": "↕",
  "&varrho;": "ϱ",
  "&varsigma;": "ς",
  "&varsubsetneq;": "⊊︀",
  "&varsubsetneqq;": "⫋︀",
  "&varsupsetneq;": "⊋︀",
  "&varsupsetneqq;": "⫌︀",
  "&vartheta;": "ϑ",
  "&vartriangleleft;": "⊲",
  "&vartriangleright;": "⊳",
  "&vcy;": "в",
  "&vdash;": "⊢",
  "&vee;": "∨",
  "&veebar;": "⊻",
  "&veeeq;": "≚",
  "&vellip;": "⋮",
  "&verbar;": "|",
  "&vert;": "|",
  "&vfr;": "𝔳",
  "&vltri;": "⊲",
  "&vnsub;": "⊂⃒",
  "&vnsup;": "⊃⃒",
  "&vopf;": "𝕧",
  "&vprop;": "∝",
  "&vrtri;": "⊳",
  "&vscr;": "𝓋",
  "&vsubnE;": "⫋︀",
  "&vsubne;": "⊊︀",
  "&vsupnE;": "⫌︀",
  "&vsupne;": "⊋︀",
  "&vzigzag;": "⦚",
  "&wcirc;": "ŵ",
  "&wedbar;": "⩟",
  "&wedge;": "∧",
  "&wedgeq;": "≙",
  "&weierp;": "℘",
  "&wfr;": "𝔴",
  "&wopf;": "𝕨",
  "&wp;": "℘",
  "&wr;": "≀",
  "&wreath;": "≀",
  "&wscr;": "𝓌",
  "&xcap;": "⋂",
  "&xcirc;": "◯",
  "&xcup;": "⋃",
  "&xdtri;": "▽",
  "&xfr;": "𝔵",
  "&xhArr;": "⟺",
  "&xharr;": "⟷",
  "&xi;": "ξ",
  "&xlArr;": "⟸",
  "&xlarr;": "⟵",
  "&xmap;": "⟼",
  "&xnis;": "⋻",
  "&xodot;": "⨀",
  "&xopf;": "𝕩",
  "&xoplus;": "⨁",
  "&xotime;": "⨂",
  "&xrArr;": "⟹",
  "&xrarr;": "⟶",
  "&xscr;": "𝓍",
  "&xsqcup;": "⨆",
  "&xuplus;": "⨄",
  "&xutri;": "△",
  "&xvee;": "⋁",
  "&xwedge;": "⋀",
  "&yacute": "ý",
  "&yacute;": "ý",
  "&yacy;": "я",
  "&ycirc;": "ŷ",
  "&ycy;": "ы",
  "&yen": "¥",
  "&yen;": "¥",
  "&yfr;": "𝔶",
  "&yicy;": "ї",
  "&yopf;": "𝕪",
  "&yscr;": "𝓎",
  "&yucy;": "ю",
  "&yuml": "ÿ",
  "&yuml;": "ÿ",
  "&zacute;": "ź",
  "&zcaron;": "ž",
  "&zcy;": "з",
  "&zdot;": "ż",
  "&zeetrf;": "ℨ",
  "&zeta;": "ζ",
  "&zfr;": "𝔷",
  "&zhcy;": "ж",
  "&zigrarr;": "⇝",
  "&zopf;": "𝕫",
  "&zscr;": "𝓏",
  "&zwj;": "‍",
  "&zwnj;": "‌"
};
function decodeHTMLEntities(str) {
  return str.replace(/&(#\d+|#x[a-f0-9]+|[a-z]+\d*);?/gi, (match, entity) => {
    if (typeof htmlEntities[match] === "string") {
      return htmlEntities[match];
    }
    if (entity.charAt(0) !== "#" || match.charAt(match.length - 1) !== ";") {
      return match;
    }
    let codePoint;
    if (entity.charAt(1) === "x") {
      codePoint = parseInt(entity.substr(2), 16);
    } else {
      codePoint = parseInt(entity.substr(1), 10);
    }
    let output = "";
    if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
      return "�";
    }
    if (codePoint > 65535) {
      codePoint -= 65536;
      output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    output += String.fromCharCode(codePoint);
    return output;
  });
}
function escapeHtml(str) {
  return str.trim().replace(/[<>"'?&]/g, (c) => {
    let hex = c.charCodeAt(0).toString(16);
    if (hex.length < 2) {
      hex = "0" + hex;
    }
    return "&#x" + hex.toUpperCase() + ";";
  });
}
function textToHtml(str) {
  let html = escapeHtml(str).replace(/\n/g, "<br />");
  return "<div>" + html + "</div>";
}
function htmlToText(str) {
  str = str.replace(/\r?\n/g, "").replace(/<\!\-\-.*?\-\->/gi, " ").replace(/<br\b[^>]*>/gi, "\n").replace(/<\/?(p|div|table|tr|td|th)\b[^>]*>/gi, "\n\n").replace(/<script\b[^>]*>.*?<\/script\b[^>]*>/gi, " ").replace(/^.*<body\b[^>]*>/i, "").replace(/^.*<\/head\b[^>]*>/i, "").replace(/^.*<\!doctype\b[^>]*>/i, "").replace(/<\/body\b[^>]*>.*$/i, "").replace(/<\/html\b[^>]*>.*$/i, "").replace(/<a\b[^>]*href\s*=\s*["']?([^\s"']+)[^>]*>/gi, " ($1) ").replace(/<\/?(span|em|i|strong|b|u|a)\b[^>]*>/gi, "").replace(/<li\b[^>]*>[\n\u0001\s]*/gi, "* ").replace(/<hr\b[^>]*>/g, "\n-------------\n").replace(/<[^>]*>/g, " ").replace(/\u0001/g, "\n").replace(/[ \t]+/g, " ").replace(/^\s+$/gm, "").replace(/\n\n+/g, "\n\n").replace(/^\n+/, "\n").replace(/\n+$/, "\n");
  str = decodeHTMLEntities(str);
  return str;
}
function formatTextAddress(address) {
  return [].concat(address.name || []).concat(address.name ? `<${address.address}>` : address.address).join(" ");
}
function formatTextAddresses(addresses) {
  let parts = [];
  let processAddress = (address, partCounter) => {
    if (partCounter) {
      parts.push(", ");
    }
    if (address.group) {
      let groupStart = `${address.name}:`;
      let groupEnd = `;`;
      parts.push(groupStart);
      address.group.forEach(processAddress);
      parts.push(groupEnd);
    } else {
      parts.push(formatTextAddress(address));
    }
  };
  addresses.forEach(processAddress);
  return parts.join("");
}
function formatHtmlAddress(address) {
  return `<a href="mailto:${escapeHtml(address.address)}" class="postal-email-address">${escapeHtml(address.name || `<${address.address}>`)}</a>`;
}
function formatHtmlAddresses(addresses) {
  let parts = [];
  let processAddress = (address, partCounter) => {
    if (partCounter) {
      parts.push('<span class="postal-email-address-separator">, </span>');
    }
    if (address.group) {
      let groupStart = `<span class="postal-email-address-group">${escapeHtml(address.name)}:</span>`;
      let groupEnd = `<span class="postal-email-address-group">;</span>`;
      parts.push(groupStart);
      address.group.forEach(processAddress);
      parts.push(groupEnd);
    } else {
      parts.push(formatHtmlAddress(address));
    }
  };
  addresses.forEach(processAddress);
  return parts.join(" ");
}
function foldLines(str, lineLength, afterSpace) {
  str = (str || "").toString();
  lineLength = lineLength || 76;
  let pos = 0, len = str.length, result = "", line, match;
  while (pos < len) {
    line = str.substr(pos, lineLength);
    if (line.length < lineLength) {
      result += line;
      break;
    }
    if (match = line.match(/^[^\n\r]*(\r?\n|\r)/)) {
      line = match[0];
      result += line;
      pos += line.length;
      continue;
    } else if ((match = line.match(/(\s+)[^\s]*$/)) && match[0].length - (match[1] || "").length < line.length) {
      line = line.substr(0, line.length - (match[0].length - (match[1] || "").length));
    } else if (match = str.substr(pos + line.length).match(/^[^\s]+(\s*)/)) {
      line = line + match[0].substr(0, match[0].length - 0);
    }
    result += line;
    pos += line.length;
    if (pos < len) {
      result += "\r\n";
    }
  }
  return result;
}
function formatTextHeader(message) {
  let rows = [];
  if (message.from) {
    rows.push({ key: "From", val: formatTextAddress(message.from) });
  }
  if (message.subject) {
    rows.push({ key: "Subject", val: message.subject });
  }
  if (message.date) {
    let dateOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false
    };
    let dateStr = typeof Intl === "undefined" ? message.date : new Intl.DateTimeFormat("default", dateOptions).format(new Date(message.date));
    rows.push({ key: "Date", val: dateStr });
  }
  if (message.to && message.to.length) {
    rows.push({ key: "To", val: formatTextAddresses(message.to) });
  }
  if (message.cc && message.cc.length) {
    rows.push({ key: "Cc", val: formatTextAddresses(message.cc) });
  }
  if (message.bcc && message.bcc.length) {
    rows.push({ key: "Bcc", val: formatTextAddresses(message.bcc) });
  }
  let maxKeyLength = rows.map((r) => r.key.length).reduce((acc, cur) => {
    return cur > acc ? cur : acc;
  }, 0);
  rows = rows.flatMap((row) => {
    let sepLen = maxKeyLength - row.key.length;
    let prefix = `${row.key}: ${" ".repeat(sepLen)}`;
    let emptyPrefix = `${" ".repeat(row.key.length + 1)} ${" ".repeat(sepLen)}`;
    let foldedLines = foldLines(row.val, 80).split(/\r?\n/).map((line) => line.trim());
    return foldedLines.map((line, i) => `${i ? emptyPrefix : prefix}${line}`);
  });
  let maxLineLength = rows.map((r) => r.length).reduce((acc, cur) => {
    return cur > acc ? cur : acc;
  }, 0);
  let lineMarker = "-".repeat(maxLineLength);
  let template = `
${lineMarker}
${rows.join("\n")}
${lineMarker}
`;
  return template;
}
function formatHtmlHeader(message) {
  let rows = [];
  if (message.from) {
    rows.push(
      `<div class="postal-email-header-key">From</div><div class="postal-email-header-value">${formatHtmlAddress(message.from)}</div>`
    );
  }
  if (message.subject) {
    rows.push(
      `<div class="postal-email-header-key">Subject</div><div class="postal-email-header-value postal-email-header-subject">${escapeHtml(
        message.subject
      )}</div>`
    );
  }
  if (message.date) {
    let dateOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false
    };
    let dateStr = typeof Intl === "undefined" ? message.date : new Intl.DateTimeFormat("default", dateOptions).format(new Date(message.date));
    rows.push(
      `<div class="postal-email-header-key">Date</div><div class="postal-email-header-value postal-email-header-date" data-date="${escapeHtml(
        message.date
      )}">${escapeHtml(dateStr)}</div>`
    );
  }
  if (message.to && message.to.length) {
    rows.push(
      `<div class="postal-email-header-key">To</div><div class="postal-email-header-value">${formatHtmlAddresses(message.to)}</div>`
    );
  }
  if (message.cc && message.cc.length) {
    rows.push(
      `<div class="postal-email-header-key">Cc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.cc)}</div>`
    );
  }
  if (message.bcc && message.bcc.length) {
    rows.push(
      `<div class="postal-email-header-key">Bcc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.bcc)}</div>`
    );
  }
  let template = `<div class="postal-email-header">${rows.length ? '<div class="postal-email-header-row">' : ""}${rows.join(
    '</div>\n<div class="postal-email-header-row">'
  )}${rows.length ? "</div>" : ""}</div>`;
  return template;
}
function _handleAddress(tokens, depth) {
  let isGroup = false;
  let state = "text";
  let address;
  let addresses = [];
  let data = {
    address: [],
    comment: [],
    group: [],
    text: [],
    textWasQuoted: []
    // Track which text tokens came from inside quotes
  };
  let i;
  let len;
  let insideQuotes = false;
  for (i = 0, len = tokens.length; i < len; i++) {
    let token = tokens[i];
    let prevToken = i ? tokens[i - 1] : null;
    if (token.type === "operator") {
      switch (token.value) {
        case "<":
          state = "address";
          insideQuotes = false;
          break;
        case "(":
          state = "comment";
          insideQuotes = false;
          break;
        case ":":
          state = "group";
          isGroup = true;
          insideQuotes = false;
          break;
        case '"':
          insideQuotes = !insideQuotes;
          state = "text";
          break;
        default:
          state = "text";
          insideQuotes = false;
          break;
      }
    } else if (token.value) {
      if (state === "address") {
        token.value = token.value.replace(/^[^<]*<\s*/, "");
      }
      if (prevToken && prevToken.noBreak && data[state].length) {
        data[state][data[state].length - 1] += token.value;
        if (state === "text" && insideQuotes) {
          data.textWasQuoted[data.textWasQuoted.length - 1] = true;
        }
      } else {
        data[state].push(token.value);
        if (state === "text") {
          data.textWasQuoted.push(insideQuotes);
        }
      }
    }
  }
  if (!data.text.length && data.comment.length) {
    data.text = data.comment;
    data.comment = [];
  }
  if (isGroup) {
    data.text = data.text.join(" ");
    let groupMembers = [];
    if (data.group.length) {
      let parsedGroup = addressParser(data.group.join(","), { _depth: depth + 1 });
      parsedGroup.forEach((member) => {
        if (member.group) {
          groupMembers = groupMembers.concat(member.group);
        } else {
          groupMembers.push(member);
        }
      });
    }
    addresses.push({
      name: decodeWords(data.text || address && address.name),
      group: groupMembers
    });
  } else {
    if (!data.address.length && data.text.length) {
      for (i = data.text.length - 1; i >= 0; i--) {
        if (!data.textWasQuoted[i] && data.text[i].match(/^[^@\s]+@[^@\s]+$/)) {
          data.address = data.text.splice(i, 1);
          data.textWasQuoted.splice(i, 1);
          break;
        }
      }
      let _regexHandler = function(address2) {
        if (!data.address.length) {
          data.address = [address2.trim()];
          return " ";
        } else {
          return address2;
        }
      };
      if (!data.address.length) {
        for (i = data.text.length - 1; i >= 0; i--) {
          if (!data.textWasQuoted[i]) {
            data.text[i] = data.text[i].replace(/\s*\b[^@\s]+@[^\s]+\b\s*/, _regexHandler).trim();
            if (data.address.length) {
              break;
            }
          }
        }
      }
    }
    if (!data.text.length && data.comment.length) {
      data.text = data.comment;
      data.comment = [];
    }
    if (data.address.length > 1) {
      data.text = data.text.concat(data.address.splice(1));
    }
    data.text = data.text.join(" ");
    data.address = data.address.join(" ");
    if (!data.address && /^=\?[^=]+?=$/.test(data.text.trim())) {
      const decodedText = decodeWords(data.text);
      if (/<[^<>]+@[^<>]+>/.test(decodedText)) {
        const parsedSubAddresses = addressParser(decodedText);
        if (parsedSubAddresses && parsedSubAddresses.length) {
          return parsedSubAddresses;
        }
      }
      return [{ address: "", name: decodedText }];
    }
    address = {
      address: data.address || data.text || "",
      name: decodeWords(data.text || data.address || "")
    };
    if (address.address === address.name) {
      if ((address.address || "").match(/@/)) {
        address.name = "";
      } else {
        address.address = "";
      }
    }
    addresses.push(address);
  }
  return addresses;
}
class Tokenizer {
  constructor(str) {
    this.str = (str || "").toString();
    this.operatorCurrent = "";
    this.operatorExpecting = "";
    this.node = null;
    this.escaped = false;
    this.list = [];
    this.operators = {
      '"': '"',
      "(": ")",
      "<": ">",
      ",": "",
      ":": ";",
      // Semicolons are not a legal delimiter per the RFC2822 grammar other
      // than for terminating a group, but they are also not valid for any
      // other use in this context.  Given that some mail clients have
      // historically allowed the semicolon as a delimiter equivalent to the
      // comma in their UI, it makes sense to treat them the same as a comma
      // when used outside of a group.
      ";": ""
    };
  }
  /**
   * Tokenizes the original input string
   *
   * @return {Array} An array of operator|text tokens
   */
  tokenize() {
    let list = [];
    for (let i = 0, len = this.str.length; i < len; i++) {
      let chr = this.str.charAt(i);
      let nextChr = i < len - 1 ? this.str.charAt(i + 1) : null;
      this.checkChar(chr, nextChr);
    }
    this.list.forEach((node) => {
      node.value = (node.value || "").toString().trim();
      if (node.value) {
        list.push(node);
      }
    });
    return list;
  }
  /**
   * Checks if a character is an operator or text and acts accordingly
   *
   * @param {String} chr Character from the address field
   */
  checkChar(chr, nextChr) {
    if (this.escaped) ;
    else if (chr === this.operatorExpecting) {
      this.node = {
        type: "operator",
        value: chr
      };
      if (nextChr && ![" ", "	", "\r", "\n", ",", ";"].includes(nextChr)) {
        this.node.noBreak = true;
      }
      this.list.push(this.node);
      this.node = null;
      this.operatorExpecting = "";
      this.escaped = false;
      return;
    } else if (!this.operatorExpecting && chr in this.operators) {
      this.node = {
        type: "operator",
        value: chr
      };
      this.list.push(this.node);
      this.node = null;
      this.operatorExpecting = this.operators[chr];
      this.escaped = false;
      return;
    } else if (this.operatorExpecting === '"' && chr === "\\") {
      this.escaped = true;
      return;
    }
    if (!this.node) {
      this.node = {
        type: "text",
        value: ""
      };
      this.list.push(this.node);
    }
    if (chr === "\n") {
      chr = " ";
    }
    if (chr.charCodeAt(0) >= 33 || [" ", "	"].includes(chr)) {
      this.node.value += chr;
    }
    this.escaped = false;
  }
}
const MAX_NESTED_GROUP_DEPTH = 50;
function addressParser(str, options) {
  options = options || {};
  let depth = options._depth || 0;
  if (depth > MAX_NESTED_GROUP_DEPTH) {
    return [];
  }
  let tokenizer = new Tokenizer(str);
  let tokens = tokenizer.tokenize();
  let addresses = [];
  let address = [];
  let parsedAddresses = [];
  tokens.forEach((token) => {
    if (token.type === "operator" && (token.value === "," || token.value === ";")) {
      if (address.length) {
        addresses.push(address);
      }
      address = [];
    } else {
      address.push(token);
    }
  });
  if (address.length) {
    addresses.push(address);
  }
  addresses.forEach((address2) => {
    address2 = _handleAddress(address2, depth);
    if (address2.length) {
      parsedAddresses = parsedAddresses.concat(address2);
    }
  });
  if (options.flatten) {
    let addresses2 = [];
    let walkAddressList = (list) => {
      list.forEach((address2) => {
        if (address2.group) {
          return walkAddressList(address2.group);
        } else {
          addresses2.push(address2);
        }
      });
    };
    walkAddressList(parsedAddresses);
    return addresses2;
  }
  return parsedAddresses;
}
function base64ArrayBuffer(arrayBuffer) {
  var base642 = "";
  var encodings = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var bytes = new Uint8Array(arrayBuffer);
  var byteLength = bytes.byteLength;
  var byteRemainder = byteLength % 3;
  var mainLength = byteLength - byteRemainder;
  var a, b, c, d;
  var chunk;
  for (var i = 0; i < mainLength; i = i + 3) {
    chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
    a = (chunk & 16515072) >> 18;
    b = (chunk & 258048) >> 12;
    c = (chunk & 4032) >> 6;
    d = chunk & 63;
    base642 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
  }
  if (byteRemainder == 1) {
    chunk = bytes[mainLength];
    a = (chunk & 252) >> 2;
    b = (chunk & 3) << 4;
    base642 += encodings[a] + encodings[b] + "==";
  } else if (byteRemainder == 2) {
    chunk = bytes[mainLength] << 8 | bytes[mainLength + 1];
    a = (chunk & 64512) >> 10;
    b = (chunk & 1008) >> 4;
    c = (chunk & 15) << 2;
    base642 += encodings[a] + encodings[b] + encodings[c] + "=";
  }
  return base642;
}
const MAX_NESTING_DEPTH = 256;
const MAX_HEADERS_SIZE = 2 * 1024 * 1024;
function toCamelCase(key) {
  return key.replace(/-(.)/g, (o, c) => c.toUpperCase());
}
class PostalMime {
  static parse(buf, options) {
    const parser = new PostalMime(options);
    return parser.parse(buf);
  }
  constructor(options) {
    this.options = options || {};
    this.mimeOptions = {
      maxNestingDepth: this.options.maxNestingDepth || MAX_NESTING_DEPTH,
      maxHeadersSize: this.options.maxHeadersSize || MAX_HEADERS_SIZE
    };
    this.root = this.currentNode = new MimeNode({
      postalMime: this,
      ...this.mimeOptions
    });
    this.boundaries = [];
    this.textContent = {};
    this.attachments = [];
    this.attachmentEncoding = (this.options.attachmentEncoding || "").toString().replace(/[-_\s]/g, "").trim().toLowerCase() || "arraybuffer";
    this.started = false;
  }
  async finalize() {
    await this.root.finalize();
  }
  async processLine(line, isFinal) {
    let boundaries = this.boundaries;
    if (boundaries.length && line.length > 2 && line[0] === 45 && line[1] === 45) {
      for (let i = boundaries.length - 1; i >= 0; i--) {
        let boundary = boundaries[i];
        if (line.length < boundary.value.length + 2) {
          continue;
        }
        let boundaryMatches = true;
        for (let j = 0; j < boundary.value.length; j++) {
          if (line[j + 2] !== boundary.value[j]) {
            boundaryMatches = false;
            break;
          }
        }
        if (!boundaryMatches) {
          continue;
        }
        let boundaryEnd = boundary.value.length + 2;
        let isTerminator = false;
        if (line.length >= boundary.value.length + 4 && line[boundary.value.length + 2] === 45 && line[boundary.value.length + 3] === 45) {
          isTerminator = true;
          boundaryEnd = boundary.value.length + 4;
        }
        let hasValidTrailing = true;
        for (let j = boundaryEnd; j < line.length; j++) {
          if (line[j] !== 32 && line[j] !== 9) {
            hasValidTrailing = false;
            break;
          }
        }
        if (!hasValidTrailing) {
          continue;
        }
        if (isTerminator) {
          await boundary.node.finalize();
          this.currentNode = boundary.node.parentNode || this.root;
        } else {
          await boundary.node.finalizeChildNodes();
          this.currentNode = new MimeNode({
            postalMime: this,
            parentNode: boundary.node,
            parentMultipartType: boundary.node.contentType.multipart,
            ...this.mimeOptions
          });
        }
        if (isFinal) {
          return this.finalize();
        }
        return;
      }
    }
    this.currentNode.feed(line);
    if (isFinal) {
      return this.finalize();
    }
  }
  readLine() {
    let startPos = this.readPos;
    let endPos = this.readPos;
    while (this.readPos < this.av.length) {
      const c = this.av[this.readPos++];
      if (c !== 13 && c !== 10) {
        endPos = this.readPos;
      }
      if (c === 10) {
        return {
          bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
          done: this.readPos >= this.av.length
        };
      }
    }
    return {
      bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
      done: this.readPos >= this.av.length
    };
  }
  async processNodeTree() {
    let textContent = {};
    let textTypes = /* @__PURE__ */ new Set();
    let textMap = this.textMap = /* @__PURE__ */ new Map();
    let forceRfc822Attachments = this.forceRfc822Attachments();
    let walk = async (node, alternative, related) => {
      alternative = alternative || false;
      related = related || false;
      if (!node.contentType.multipart) {
        if (this.isInlineMessageRfc822(node) && !forceRfc822Attachments) {
          const subParser = new PostalMime();
          node.subMessage = await subParser.parse(node.content);
          if (!textMap.has(node)) {
            textMap.set(node, {});
          }
          let textEntry = textMap.get(node);
          if (node.subMessage.text || !node.subMessage.html) {
            textEntry.plain = textEntry.plain || [];
            textEntry.plain.push({ type: "subMessage", value: node.subMessage });
            textTypes.add("plain");
          }
          if (node.subMessage.html) {
            textEntry.html = textEntry.html || [];
            textEntry.html.push({ type: "subMessage", value: node.subMessage });
            textTypes.add("html");
          }
          if (subParser.textMap) {
            subParser.textMap.forEach((subTextEntry, subTextNode) => {
              textMap.set(subTextNode, subTextEntry);
            });
          }
          for (let attachment of node.subMessage.attachments || []) {
            this.attachments.push(attachment);
          }
        } else if (this.isInlineTextNode(node)) {
          let textType = node.contentType.parsed.value.substr(node.contentType.parsed.value.indexOf("/") + 1);
          let selectorNode = alternative || node;
          if (!textMap.has(selectorNode)) {
            textMap.set(selectorNode, {});
          }
          let textEntry = textMap.get(selectorNode);
          textEntry[textType] = textEntry[textType] || [];
          textEntry[textType].push({ type: "text", value: node.getTextContent() });
          textTypes.add(textType);
        } else if (node.content) {
          const filename = node.contentDisposition?.parsed?.params?.filename || node.contentType.parsed.params.name || null;
          const attachment = {
            filename: filename ? decodeWords(filename) : null,
            mimeType: node.contentType.parsed.value,
            disposition: node.contentDisposition?.parsed?.value || null
          };
          if (related && node.contentId) {
            attachment.related = true;
          }
          if (node.contentDescription) {
            attachment.description = node.contentDescription;
          }
          if (node.contentId) {
            attachment.contentId = node.contentId;
          }
          switch (node.contentType.parsed.value) {
            // Special handling for calendar events
            case "text/calendar":
            case "application/ics": {
              if (node.contentType.parsed.params.method) {
                attachment.method = node.contentType.parsed.params.method.toString().toUpperCase().trim();
              }
              const decodedText = node.getTextContent().replace(/\r?\n/g, "\n").replace(/\n*$/, "\n");
              attachment.content = textEncoder.encode(decodedText);
              break;
            }
            // Regular attachments
            default:
              attachment.content = node.content;
          }
          this.attachments.push(attachment);
        }
      } else if (node.contentType.multipart === "alternative") {
        alternative = node;
      } else if (node.contentType.multipart === "related") {
        related = node;
      }
      for (let childNode of node.childNodes) {
        await walk(childNode, alternative, related);
      }
    };
    await walk(this.root, false, false);
    textMap.forEach((mapEntry) => {
      textTypes.forEach((textType) => {
        if (!textContent[textType]) {
          textContent[textType] = [];
        }
        if (mapEntry[textType]) {
          mapEntry[textType].forEach((textEntry) => {
            switch (textEntry.type) {
              case "text":
                textContent[textType].push(textEntry.value);
                break;
              case "subMessage":
                {
                  switch (textType) {
                    case "html":
                      textContent[textType].push(formatHtmlHeader(textEntry.value));
                      break;
                    case "plain":
                      textContent[textType].push(formatTextHeader(textEntry.value));
                      break;
                  }
                }
                break;
            }
          });
        } else {
          let alternativeType;
          switch (textType) {
            case "html":
              alternativeType = "plain";
              break;
            case "plain":
              alternativeType = "html";
              break;
          }
          (mapEntry[alternativeType] || []).forEach((textEntry) => {
            switch (textEntry.type) {
              case "text":
                switch (textType) {
                  case "html":
                    textContent[textType].push(textToHtml(textEntry.value));
                    break;
                  case "plain":
                    textContent[textType].push(htmlToText(textEntry.value));
                    break;
                }
                break;
              case "subMessage":
                {
                  switch (textType) {
                    case "html":
                      textContent[textType].push(formatHtmlHeader(textEntry.value));
                      break;
                    case "plain":
                      textContent[textType].push(formatTextHeader(textEntry.value));
                      break;
                  }
                }
                break;
            }
          });
        }
      });
    });
    Object.keys(textContent).forEach((textType) => {
      textContent[textType] = textContent[textType].join("\n");
    });
    this.textContent = textContent;
  }
  isInlineTextNode(node) {
    if (node.contentDisposition?.parsed?.value === "attachment") {
      return false;
    }
    switch (node.contentType.parsed?.value) {
      case "text/html":
      case "text/plain":
        return true;
      case "text/calendar":
      case "text/csv":
      default:
        return false;
    }
  }
  isInlineMessageRfc822(node) {
    if (node.contentType.parsed?.value !== "message/rfc822") {
      return false;
    }
    let disposition = node.contentDisposition?.parsed?.value || (this.options.rfc822Attachments ? "attachment" : "inline");
    return disposition === "inline";
  }
  // Check if this is a specially crafted report email where message/rfc822 content should not be inlined
  forceRfc822Attachments() {
    if (this.options.forceRfc822Attachments) {
      return true;
    }
    let forceRfc822Attachments = false;
    let walk = (node) => {
      if (!node.contentType.multipart) {
        if (node.contentType.parsed && ["message/delivery-status", "message/feedback-report"].includes(node.contentType.parsed.value)) {
          forceRfc822Attachments = true;
        }
      }
      for (let childNode of node.childNodes) {
        walk(childNode);
      }
    };
    walk(this.root);
    return forceRfc822Attachments;
  }
  async resolveStream(stream) {
    let chunkLen = 0;
    let chunks = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      chunkLen += value.length;
    }
    const result = new Uint8Array(chunkLen);
    let chunkPointer = 0;
    for (let chunk of chunks) {
      result.set(chunk, chunkPointer);
      chunkPointer += chunk.length;
    }
    return result;
  }
  async parse(buf) {
    if (this.started) {
      throw new Error("Can not reuse parser, create a new PostalMime object");
    }
    this.started = true;
    if (buf && typeof buf.getReader === "function") {
      buf = await this.resolveStream(buf);
    }
    buf = buf || new ArrayBuffer(0);
    if (typeof buf === "string") {
      buf = textEncoder.encode(buf);
    }
    if (buf instanceof Blob || Object.prototype.toString.call(buf) === "[object Blob]") {
      buf = await blobToArrayBuffer(buf);
    }
    if (buf.buffer instanceof ArrayBuffer) {
      buf = new Uint8Array(buf).buffer;
    }
    this.buf = buf;
    this.av = new Uint8Array(buf);
    this.readPos = 0;
    while (this.readPos < this.av.length) {
      const line = this.readLine();
      await this.processLine(line.bytes, line.done);
    }
    await this.processNodeTree();
    const message = {
      headers: this.root.headers.map((entry) => ({ key: entry.key, originalKey: entry.originalKey, value: entry.value })).reverse()
    };
    for (const key of ["from", "sender"]) {
      const addressHeader = this.root.headers.find((line) => line.key === key);
      if (addressHeader && addressHeader.value) {
        const addresses = addressParser(addressHeader.value);
        if (addresses && addresses.length) {
          message[key] = addresses[0];
        }
      }
    }
    for (const key of ["delivered-to", "return-path"]) {
      const addressHeader = this.root.headers.find((line) => line.key === key);
      if (addressHeader && addressHeader.value) {
        const addresses = addressParser(addressHeader.value);
        if (addresses && addresses.length && addresses[0].address) {
          const camelKey = toCamelCase(key);
          message[camelKey] = addresses[0].address;
        }
      }
    }
    for (const key of ["to", "cc", "bcc", "reply-to"]) {
      const addressHeaders = this.root.headers.filter((line) => line.key === key);
      let addresses = [];
      addressHeaders.filter((entry) => entry && entry.value).map((entry) => addressParser(entry.value)).forEach((parsed) => addresses = addresses.concat(parsed || []));
      if (addresses && addresses.length) {
        const camelKey = toCamelCase(key);
        message[camelKey] = addresses;
      }
    }
    for (const key of ["subject", "message-id", "in-reply-to", "references"]) {
      const header = this.root.headers.find((line) => line.key === key);
      if (header && header.value) {
        const camelKey = toCamelCase(key);
        message[camelKey] = decodeWords(header.value);
      }
    }
    let dateHeader = this.root.headers.find((line) => line.key === "date");
    if (dateHeader) {
      let date = new Date(dateHeader.value);
      if (date.toString() === "Invalid Date") {
        date = dateHeader.value;
      } else {
        date = date.toISOString();
      }
      message.date = date;
    }
    if (this.textContent?.html) {
      message.html = this.textContent.html;
    }
    if (this.textContent?.plain) {
      message.text = this.textContent.plain;
    }
    message.attachments = this.attachments;
    message.headerLines = (this.root.rawHeaderLines || []).slice().reverse();
    switch (this.attachmentEncoding) {
      case "arraybuffer":
        break;
      case "base64":
        for (let attachment of message.attachments || []) {
          if (attachment?.content) {
            attachment.content = base64ArrayBuffer(attachment.content);
            attachment.encoding = "base64";
          }
        }
        break;
      case "utf8":
        let attachmentDecoder = new TextDecoder("utf8");
        for (let attachment of message.attachments || []) {
          if (attachment?.content) {
            attachment.content = attachmentDecoder.decode(attachment.content);
            attachment.encoding = "utf8";
          }
        }
        break;
      default:
        throw new Error("Unknown attachment encoding");
    }
    return message;
  }
}
var dist = {};
var timing_safe_equal = {};
var hasRequiredTiming_safe_equal;
function requireTiming_safe_equal() {
  if (hasRequiredTiming_safe_equal) return timing_safe_equal;
  hasRequiredTiming_safe_equal = 1;
  Object.defineProperty(timing_safe_equal, "__esModule", { value: true });
  timing_safe_equal.timingSafeEqual = void 0;
  function assert(expr, msg = "") {
    if (!expr) {
      throw new Error(msg);
    }
  }
  function timingSafeEqual(a, b) {
    if (a.byteLength !== b.byteLength) {
      return false;
    }
    if (!(a instanceof DataView)) {
      a = new DataView(ArrayBuffer.isView(a) ? a.buffer : a);
    }
    if (!(b instanceof DataView)) {
      b = new DataView(ArrayBuffer.isView(b) ? b.buffer : b);
    }
    assert(a instanceof DataView);
    assert(b instanceof DataView);
    const length = a.byteLength;
    let out = 0;
    let i = -1;
    while (++i < length) {
      out |= a.getUint8(i) ^ b.getUint8(i);
    }
    return out === 0;
  }
  timing_safe_equal.timingSafeEqual = timingSafeEqual;
  return timing_safe_equal;
}
var base64 = {};
var hasRequiredBase64;
function requireBase64() {
  if (hasRequiredBase64) return base64;
  hasRequiredBase64 = 1;
  var __extends = base64 && base64.__extends || /* @__PURE__ */ (function() {
    var extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    return function(d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
  })();
  Object.defineProperty(base64, "__esModule", { value: true });
  var INVALID_BYTE = 256;
  var Coder = (
    /** @class */
    (function() {
      function Coder2(_paddingCharacter) {
        if (_paddingCharacter === void 0) {
          _paddingCharacter = "=";
        }
        this._paddingCharacter = _paddingCharacter;
      }
      Coder2.prototype.encodedLength = function(length) {
        if (!this._paddingCharacter) {
          return (length * 8 + 5) / 6 | 0;
        }
        return (length + 2) / 3 * 4 | 0;
      };
      Coder2.prototype.encode = function(data) {
        var out = "";
        var i = 0;
        for (; i < data.length - 2; i += 3) {
          var c = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
          out += this._encodeByte(c >>> 3 * 6 & 63);
          out += this._encodeByte(c >>> 2 * 6 & 63);
          out += this._encodeByte(c >>> 1 * 6 & 63);
          out += this._encodeByte(c >>> 0 * 6 & 63);
        }
        var left = data.length - i;
        if (left > 0) {
          var c = data[i] << 16 | (left === 2 ? data[i + 1] << 8 : 0);
          out += this._encodeByte(c >>> 3 * 6 & 63);
          out += this._encodeByte(c >>> 2 * 6 & 63);
          if (left === 2) {
            out += this._encodeByte(c >>> 1 * 6 & 63);
          } else {
            out += this._paddingCharacter || "";
          }
          out += this._paddingCharacter || "";
        }
        return out;
      };
      Coder2.prototype.maxDecodedLength = function(length) {
        if (!this._paddingCharacter) {
          return (length * 6 + 7) / 8 | 0;
        }
        return length / 4 * 3 | 0;
      };
      Coder2.prototype.decodedLength = function(s) {
        return this.maxDecodedLength(s.length - this._getPaddingLength(s));
      };
      Coder2.prototype.decode = function(s) {
        if (s.length === 0) {
          return new Uint8Array(0);
        }
        var paddingLength = this._getPaddingLength(s);
        var length = s.length - paddingLength;
        var out = new Uint8Array(this.maxDecodedLength(length));
        var op = 0;
        var i = 0;
        var haveBad = 0;
        var v0 = 0, v1 = 0, v2 = 0, v3 = 0;
        for (; i < length - 4; i += 4) {
          v0 = this._decodeChar(s.charCodeAt(i + 0));
          v1 = this._decodeChar(s.charCodeAt(i + 1));
          v2 = this._decodeChar(s.charCodeAt(i + 2));
          v3 = this._decodeChar(s.charCodeAt(i + 3));
          out[op++] = v0 << 2 | v1 >>> 4;
          out[op++] = v1 << 4 | v2 >>> 2;
          out[op++] = v2 << 6 | v3;
          haveBad |= v0 & INVALID_BYTE;
          haveBad |= v1 & INVALID_BYTE;
          haveBad |= v2 & INVALID_BYTE;
          haveBad |= v3 & INVALID_BYTE;
        }
        if (i < length - 1) {
          v0 = this._decodeChar(s.charCodeAt(i));
          v1 = this._decodeChar(s.charCodeAt(i + 1));
          out[op++] = v0 << 2 | v1 >>> 4;
          haveBad |= v0 & INVALID_BYTE;
          haveBad |= v1 & INVALID_BYTE;
        }
        if (i < length - 2) {
          v2 = this._decodeChar(s.charCodeAt(i + 2));
          out[op++] = v1 << 4 | v2 >>> 2;
          haveBad |= v2 & INVALID_BYTE;
        }
        if (i < length - 3) {
          v3 = this._decodeChar(s.charCodeAt(i + 3));
          out[op++] = v2 << 6 | v3;
          haveBad |= v3 & INVALID_BYTE;
        }
        if (haveBad !== 0) {
          throw new Error("Base64Coder: incorrect characters for decoding");
        }
        return out;
      };
      Coder2.prototype._encodeByte = function(b) {
        var result = b;
        result += 65;
        result += 25 - b >>> 8 & 0 - 65 - 26 + 97;
        result += 51 - b >>> 8 & 26 - 97 - 52 + 48;
        result += 61 - b >>> 8 & 52 - 48 - 62 + 43;
        result += 62 - b >>> 8 & 62 - 43 - 63 + 47;
        return String.fromCharCode(result);
      };
      Coder2.prototype._decodeChar = function(c) {
        var result = INVALID_BYTE;
        result += (42 - c & c - 44) >>> 8 & -INVALID_BYTE + c - 43 + 62;
        result += (46 - c & c - 48) >>> 8 & -INVALID_BYTE + c - 47 + 63;
        result += (47 - c & c - 58) >>> 8 & -INVALID_BYTE + c - 48 + 52;
        result += (64 - c & c - 91) >>> 8 & -INVALID_BYTE + c - 65 + 0;
        result += (96 - c & c - 123) >>> 8 & -INVALID_BYTE + c - 97 + 26;
        return result;
      };
      Coder2.prototype._getPaddingLength = function(s) {
        var paddingLength = 0;
        if (this._paddingCharacter) {
          for (var i = s.length - 1; i >= 0; i--) {
            if (s[i] !== this._paddingCharacter) {
              break;
            }
            paddingLength++;
          }
          if (s.length < 4 || paddingLength > 2) {
            throw new Error("Base64Coder: incorrect padding");
          }
        }
        return paddingLength;
      };
      return Coder2;
    })()
  );
  base64.Coder = Coder;
  var stdCoder = new Coder();
  function encode(data) {
    return stdCoder.encode(data);
  }
  base64.encode = encode;
  function decode(s) {
    return stdCoder.decode(s);
  }
  base64.decode = decode;
  var URLSafeCoder = (
    /** @class */
    (function(_super) {
      __extends(URLSafeCoder2, _super);
      function URLSafeCoder2() {
        return _super !== null && _super.apply(this, arguments) || this;
      }
      URLSafeCoder2.prototype._encodeByte = function(b) {
        var result = b;
        result += 65;
        result += 25 - b >>> 8 & 0 - 65 - 26 + 97;
        result += 51 - b >>> 8 & 26 - 97 - 52 + 48;
        result += 61 - b >>> 8 & 52 - 48 - 62 + 45;
        result += 62 - b >>> 8 & 62 - 45 - 63 + 95;
        return String.fromCharCode(result);
      };
      URLSafeCoder2.prototype._decodeChar = function(c) {
        var result = INVALID_BYTE;
        result += (44 - c & c - 46) >>> 8 & -INVALID_BYTE + c - 45 + 62;
        result += (94 - c & c - 96) >>> 8 & -INVALID_BYTE + c - 95 + 63;
        result += (47 - c & c - 58) >>> 8 & -INVALID_BYTE + c - 48 + 52;
        result += (64 - c & c - 91) >>> 8 & -INVALID_BYTE + c - 65 + 0;
        result += (96 - c & c - 123) >>> 8 & -INVALID_BYTE + c - 97 + 26;
        return result;
      };
      return URLSafeCoder2;
    })(Coder)
  );
  base64.URLSafeCoder = URLSafeCoder;
  var urlSafeCoder = new URLSafeCoder();
  function encodeURLSafe(data) {
    return urlSafeCoder.encode(data);
  }
  base64.encodeURLSafe = encodeURLSafe;
  function decodeURLSafe(s) {
    return urlSafeCoder.decode(s);
  }
  base64.decodeURLSafe = decodeURLSafe;
  base64.encodedLength = function(length) {
    return stdCoder.encodedLength(length);
  };
  base64.maxDecodedLength = function(length) {
    return stdCoder.maxDecodedLength(length);
  };
  base64.decodedLength = function(s) {
    return stdCoder.decodedLength(s);
  };
  return base64;
}
var sha256$1 = { exports: {} };
var sha256 = sha256$1.exports;
var hasRequiredSha256;
function requireSha256() {
  if (hasRequiredSha256) return sha256$1.exports;
  hasRequiredSha256 = 1;
  (function(module) {
    (function(root, factory) {
      var exports = {};
      factory(exports);
      var sha2562 = exports["default"];
      for (var k in exports) {
        sha2562[k] = exports[k];
      }
      {
        module.exports = sha2562;
      }
    })(sha256, function(exports) {
      exports.__esModule = true;
      exports.digestLength = 32;
      exports.blockSize = 64;
      var K = new Uint32Array([
        1116352408,
        1899447441,
        3049323471,
        3921009573,
        961987163,
        1508970993,
        2453635748,
        2870763221,
        3624381080,
        310598401,
        607225278,
        1426881987,
        1925078388,
        2162078206,
        2614888103,
        3248222580,
        3835390401,
        4022224774,
        264347078,
        604807628,
        770255983,
        1249150122,
        1555081692,
        1996064986,
        2554220882,
        2821834349,
        2952996808,
        3210313671,
        3336571891,
        3584528711,
        113926993,
        338241895,
        666307205,
        773529912,
        1294757372,
        1396182291,
        1695183700,
        1986661051,
        2177026350,
        2456956037,
        2730485921,
        2820302411,
        3259730800,
        3345764771,
        3516065817,
        3600352804,
        4094571909,
        275423344,
        430227734,
        506948616,
        659060556,
        883997877,
        958139571,
        1322822218,
        1537002063,
        1747873779,
        1955562222,
        2024104815,
        2227730452,
        2361852424,
        2428436474,
        2756734187,
        3204031479,
        3329325298
      ]);
      function hashBlocks(w, v, p, pos, len) {
        var a, b, c, d, e, f, g, h, u, i, j, t1, t2;
        while (len >= 64) {
          a = v[0];
          b = v[1];
          c = v[2];
          d = v[3];
          e = v[4];
          f = v[5];
          g = v[6];
          h = v[7];
          for (i = 0; i < 16; i++) {
            j = pos + i * 4;
            w[i] = (p[j] & 255) << 24 | (p[j + 1] & 255) << 16 | (p[j + 2] & 255) << 8 | p[j + 3] & 255;
          }
          for (i = 16; i < 64; i++) {
            u = w[i - 2];
            t1 = (u >>> 17 | u << 32 - 17) ^ (u >>> 19 | u << 32 - 19) ^ u >>> 10;
            u = w[i - 15];
            t2 = (u >>> 7 | u << 32 - 7) ^ (u >>> 18 | u << 32 - 18) ^ u >>> 3;
            w[i] = (t1 + w[i - 7] | 0) + (t2 + w[i - 16] | 0);
          }
          for (i = 0; i < 64; i++) {
            t1 = (((e >>> 6 | e << 32 - 6) ^ (e >>> 11 | e << 32 - 11) ^ (e >>> 25 | e << 32 - 25)) + (e & f ^ ~e & g) | 0) + (h + (K[i] + w[i] | 0) | 0) | 0;
            t2 = ((a >>> 2 | a << 32 - 2) ^ (a >>> 13 | a << 32 - 13) ^ (a >>> 22 | a << 32 - 22)) + (a & b ^ a & c ^ b & c) | 0;
            h = g;
            g = f;
            f = e;
            e = d + t1 | 0;
            d = c;
            c = b;
            b = a;
            a = t1 + t2 | 0;
          }
          v[0] += a;
          v[1] += b;
          v[2] += c;
          v[3] += d;
          v[4] += e;
          v[5] += f;
          v[6] += g;
          v[7] += h;
          pos += 64;
          len -= 64;
        }
        return pos;
      }
      var Hash = (
        /** @class */
        (function() {
          function Hash2() {
            this.digestLength = exports.digestLength;
            this.blockSize = exports.blockSize;
            this.state = new Int32Array(8);
            this.temp = new Int32Array(64);
            this.buffer = new Uint8Array(128);
            this.bufferLength = 0;
            this.bytesHashed = 0;
            this.finished = false;
            this.reset();
          }
          Hash2.prototype.reset = function() {
            this.state[0] = 1779033703;
            this.state[1] = 3144134277;
            this.state[2] = 1013904242;
            this.state[3] = 2773480762;
            this.state[4] = 1359893119;
            this.state[5] = 2600822924;
            this.state[6] = 528734635;
            this.state[7] = 1541459225;
            this.bufferLength = 0;
            this.bytesHashed = 0;
            this.finished = false;
            return this;
          };
          Hash2.prototype.clean = function() {
            for (var i = 0; i < this.buffer.length; i++) {
              this.buffer[i] = 0;
            }
            for (var i = 0; i < this.temp.length; i++) {
              this.temp[i] = 0;
            }
            this.reset();
          };
          Hash2.prototype.update = function(data, dataLength) {
            if (dataLength === void 0) {
              dataLength = data.length;
            }
            if (this.finished) {
              throw new Error("SHA256: can't update because hash was finished.");
            }
            var dataPos = 0;
            this.bytesHashed += dataLength;
            if (this.bufferLength > 0) {
              while (this.bufferLength < 64 && dataLength > 0) {
                this.buffer[this.bufferLength++] = data[dataPos++];
                dataLength--;
              }
              if (this.bufferLength === 64) {
                hashBlocks(this.temp, this.state, this.buffer, 0, 64);
                this.bufferLength = 0;
              }
            }
            if (dataLength >= 64) {
              dataPos = hashBlocks(this.temp, this.state, data, dataPos, dataLength);
              dataLength %= 64;
            }
            while (dataLength > 0) {
              this.buffer[this.bufferLength++] = data[dataPos++];
              dataLength--;
            }
            return this;
          };
          Hash2.prototype.finish = function(out) {
            if (!this.finished) {
              var bytesHashed = this.bytesHashed;
              var left = this.bufferLength;
              var bitLenHi = bytesHashed / 536870912 | 0;
              var bitLenLo = bytesHashed << 3;
              var padLength = bytesHashed % 64 < 56 ? 64 : 128;
              this.buffer[left] = 128;
              for (var i = left + 1; i < padLength - 8; i++) {
                this.buffer[i] = 0;
              }
              this.buffer[padLength - 8] = bitLenHi >>> 24 & 255;
              this.buffer[padLength - 7] = bitLenHi >>> 16 & 255;
              this.buffer[padLength - 6] = bitLenHi >>> 8 & 255;
              this.buffer[padLength - 5] = bitLenHi >>> 0 & 255;
              this.buffer[padLength - 4] = bitLenLo >>> 24 & 255;
              this.buffer[padLength - 3] = bitLenLo >>> 16 & 255;
              this.buffer[padLength - 2] = bitLenLo >>> 8 & 255;
              this.buffer[padLength - 1] = bitLenLo >>> 0 & 255;
              hashBlocks(this.temp, this.state, this.buffer, 0, padLength);
              this.finished = true;
            }
            for (var i = 0; i < 8; i++) {
              out[i * 4 + 0] = this.state[i] >>> 24 & 255;
              out[i * 4 + 1] = this.state[i] >>> 16 & 255;
              out[i * 4 + 2] = this.state[i] >>> 8 & 255;
              out[i * 4 + 3] = this.state[i] >>> 0 & 255;
            }
            return this;
          };
          Hash2.prototype.digest = function() {
            var out = new Uint8Array(this.digestLength);
            this.finish(out);
            return out;
          };
          Hash2.prototype._saveState = function(out) {
            for (var i = 0; i < this.state.length; i++) {
              out[i] = this.state[i];
            }
          };
          Hash2.prototype._restoreState = function(from, bytesHashed) {
            for (var i = 0; i < this.state.length; i++) {
              this.state[i] = from[i];
            }
            this.bytesHashed = bytesHashed;
            this.finished = false;
            this.bufferLength = 0;
          };
          return Hash2;
        })()
      );
      exports.Hash = Hash;
      var HMAC = (
        /** @class */
        (function() {
          function HMAC2(key) {
            this.inner = new Hash();
            this.outer = new Hash();
            this.blockSize = this.inner.blockSize;
            this.digestLength = this.inner.digestLength;
            var pad = new Uint8Array(this.blockSize);
            if (key.length > this.blockSize) {
              new Hash().update(key).finish(pad).clean();
            } else {
              for (var i = 0; i < key.length; i++) {
                pad[i] = key[i];
              }
            }
            for (var i = 0; i < pad.length; i++) {
              pad[i] ^= 54;
            }
            this.inner.update(pad);
            for (var i = 0; i < pad.length; i++) {
              pad[i] ^= 54 ^ 92;
            }
            this.outer.update(pad);
            this.istate = new Uint32Array(8);
            this.ostate = new Uint32Array(8);
            this.inner._saveState(this.istate);
            this.outer._saveState(this.ostate);
            for (var i = 0; i < pad.length; i++) {
              pad[i] = 0;
            }
          }
          HMAC2.prototype.reset = function() {
            this.inner._restoreState(this.istate, this.inner.blockSize);
            this.outer._restoreState(this.ostate, this.outer.blockSize);
            return this;
          };
          HMAC2.prototype.clean = function() {
            for (var i = 0; i < this.istate.length; i++) {
              this.ostate[i] = this.istate[i] = 0;
            }
            this.inner.clean();
            this.outer.clean();
          };
          HMAC2.prototype.update = function(data) {
            this.inner.update(data);
            return this;
          };
          HMAC2.prototype.finish = function(out) {
            if (this.outer.finished) {
              this.outer.finish(out);
            } else {
              this.inner.finish(out);
              this.outer.update(out, this.digestLength).finish(out);
            }
            return this;
          };
          HMAC2.prototype.digest = function() {
            var out = new Uint8Array(this.digestLength);
            this.finish(out);
            return out;
          };
          return HMAC2;
        })()
      );
      exports.HMAC = HMAC;
      function hash(data) {
        var h = new Hash().update(data);
        var digest = h.digest();
        h.clean();
        return digest;
      }
      exports.hash = hash;
      exports["default"] = hash;
      function hmac(key, data) {
        var h = new HMAC(key).update(data);
        var digest = h.digest();
        h.clean();
        return digest;
      }
      exports.hmac = hmac;
      function fillBuffer(buffer, hmac2, info, counter) {
        var num = counter[0];
        if (num === 0) {
          throw new Error("hkdf: cannot expand more");
        }
        hmac2.reset();
        if (num > 1) {
          hmac2.update(buffer);
        }
        if (info) {
          hmac2.update(info);
        }
        hmac2.update(counter);
        hmac2.finish(buffer);
        counter[0]++;
      }
      var hkdfSalt = new Uint8Array(exports.digestLength);
      function hkdf(key, salt, info, length) {
        if (salt === void 0) {
          salt = hkdfSalt;
        }
        if (length === void 0) {
          length = 32;
        }
        var counter = new Uint8Array([1]);
        var okm = hmac(salt, key);
        var hmac_ = new HMAC(okm);
        var buffer = new Uint8Array(hmac_.digestLength);
        var bufpos = buffer.length;
        var out = new Uint8Array(length);
        for (var i = 0; i < length; i++) {
          if (bufpos === buffer.length) {
            fillBuffer(buffer, hmac_, info, counter);
            bufpos = 0;
          }
          out[i] = buffer[bufpos++];
        }
        hmac_.clean();
        buffer.fill(0);
        counter.fill(0);
        return out;
      }
      exports.hkdf = hkdf;
      function pbkdf2(password, salt, iterations, dkLen) {
        var prf = new HMAC(password);
        var len = prf.digestLength;
        var ctr = new Uint8Array(4);
        var t = new Uint8Array(len);
        var u = new Uint8Array(len);
        var dk = new Uint8Array(dkLen);
        for (var i = 0; i * len < dkLen; i++) {
          var c = i + 1;
          ctr[0] = c >>> 24 & 255;
          ctr[1] = c >>> 16 & 255;
          ctr[2] = c >>> 8 & 255;
          ctr[3] = c >>> 0 & 255;
          prf.reset();
          prf.update(salt);
          prf.update(ctr);
          prf.finish(u);
          for (var j = 0; j < len; j++) {
            t[j] = u[j];
          }
          for (var j = 2; j <= iterations; j++) {
            prf.reset();
            prf.update(u).finish(u);
            for (var k = 0; k < len; k++) {
              t[k] ^= u[k];
            }
          }
          for (var j = 0; j < len && i * len + j < dkLen; j++) {
            dk[i * len + j] = t[j];
          }
        }
        for (var i = 0; i < len; i++) {
          t[i] = u[i] = 0;
        }
        for (var i = 0; i < 4; i++) {
          ctr[i] = 0;
        }
        prf.clean();
        return dk;
      }
      exports.pbkdf2 = pbkdf2;
    });
  })(sha256$1);
  return sha256$1.exports;
}
var hasRequiredDist;
function requireDist() {
  if (hasRequiredDist) return dist;
  hasRequiredDist = 1;
  Object.defineProperty(dist, "__esModule", { value: true });
  dist.Webhook = dist.WebhookVerificationError = void 0;
  const timing_safe_equal_1 = requireTiming_safe_equal();
  const base642 = requireBase64();
  const sha2562 = requireSha256();
  const WEBHOOK_TOLERANCE_IN_SECONDS = 5 * 60;
  class ExtendableError extends Error {
    constructor(message) {
      super(message);
      Object.setPrototypeOf(this, ExtendableError.prototype);
      this.name = "ExtendableError";
      this.stack = new Error(message).stack;
    }
  }
  class WebhookVerificationError extends ExtendableError {
    constructor(message) {
      super(message);
      Object.setPrototypeOf(this, WebhookVerificationError.prototype);
      this.name = "WebhookVerificationError";
    }
  }
  dist.WebhookVerificationError = WebhookVerificationError;
  class Webhook {
    constructor(secret, options) {
      if (!secret) {
        throw new Error("Secret can't be empty.");
      }
      if ((options === null || options === void 0 ? void 0 : options.format) === "raw") {
        if (secret instanceof Uint8Array) {
          this.key = secret;
        } else {
          this.key = Uint8Array.from(secret, (c) => c.charCodeAt(0));
        }
      } else {
        if (typeof secret !== "string") {
          throw new Error("Expected secret to be of type string");
        }
        if (secret.startsWith(Webhook.prefix)) {
          secret = secret.substring(Webhook.prefix.length);
        }
        this.key = base642.decode(secret);
      }
    }
    verify(payload, headers_) {
      const headers = {};
      for (const key of Object.keys(headers_)) {
        headers[key.toLowerCase()] = headers_[key];
      }
      const msgId = headers["webhook-id"];
      const msgSignature = headers["webhook-signature"];
      const msgTimestamp = headers["webhook-timestamp"];
      if (!msgSignature || !msgId || !msgTimestamp) {
        throw new WebhookVerificationError("Missing required headers");
      }
      const timestamp = this.verifyTimestamp(msgTimestamp);
      const computedSignature = this.sign(msgId, timestamp, payload);
      const expectedSignature = computedSignature.split(",")[1];
      const passedSignatures = msgSignature.split(" ");
      const encoder = new globalThis.TextEncoder();
      for (const versionedSignature of passedSignatures) {
        const [version2, signature] = versionedSignature.split(",");
        if (version2 !== "v1") {
          continue;
        }
        if ((0, timing_safe_equal_1.timingSafeEqual)(encoder.encode(signature), encoder.encode(expectedSignature))) {
          return JSON.parse(payload.toString());
        }
      }
      throw new WebhookVerificationError("No matching signature found");
    }
    sign(msgId, timestamp, payload) {
      if (typeof payload === "string") ;
      else if (payload.constructor.name === "Buffer") {
        payload = payload.toString();
      } else {
        throw new Error("Expected payload to be of type string or Buffer.");
      }
      const encoder = new TextEncoder();
      const timestampNumber = Math.floor(timestamp.getTime() / 1e3);
      const toSign = encoder.encode(`${msgId}.${timestampNumber}.${payload}`);
      const expectedSignature = base642.encode(sha2562.hmac(this.key, toSign));
      return `v1,${expectedSignature}`;
    }
    verifyTimestamp(timestampHeader) {
      const now = Math.floor(Date.now() / 1e3);
      const timestamp = parseInt(timestampHeader, 10);
      if (isNaN(timestamp)) {
        throw new WebhookVerificationError("Invalid Signature Headers");
      }
      if (now - timestamp > WEBHOOK_TOLERANCE_IN_SECONDS) {
        throw new WebhookVerificationError("Message timestamp too old");
      }
      if (timestamp > now + WEBHOOK_TOLERANCE_IN_SECONDS) {
        throw new WebhookVerificationError("Message timestamp too new");
      }
      return new Date(timestamp * 1e3);
    }
  }
  dist.Webhook = Webhook;
  Webhook.prefix = "whsec_";
  return dist;
}
var distExports = requireDist();
var define_process_env_default = {};
var version = "6.12.4";
function buildPaginationQuery(options) {
  const searchParams = new URLSearchParams();
  if (options.limit !== void 0) searchParams.set("limit", options.limit.toString());
  if ("after" in options && options.after !== void 0) searchParams.set("after", options.after);
  if ("before" in options && options.before !== void 0) searchParams.set("before", options.before);
  return searchParams.toString();
}
var ApiKeys = class {
  constructor(resend) {
    this.resend = resend;
  }
  async create(payload, options = {}) {
    return await this.resend.post("/api-keys", payload, options);
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/api-keys?${queryString}` : "/api-keys";
    return await this.resend.get(url);
  }
  async remove(id) {
    return await this.resend.delete(`/api-keys/${id}`);
  }
};
var AutomationRuns = class {
  constructor(resend) {
    this.resend = resend;
  }
  async get(options) {
    return await this.resend.get(`/automations/${options.automationId}/runs/${options.runId}`);
  }
  async list(options) {
    const queryString = buildPaginationQuery(options);
    const searchParams = new URLSearchParams(queryString);
    if (options.status) {
      const statusValue = Array.isArray(options.status) ? options.status.join(",") : options.status;
      searchParams.set("status", statusValue);
    }
    const qs = searchParams.toString();
    const url = qs ? `/automations/${options.automationId}/runs?${qs}` : `/automations/${options.automationId}/runs`;
    return await this.resend.get(url);
  }
};
function parseStepConfig(step) {
  switch (step.type) {
    case "trigger":
      return {
        key: step.key,
        type: step.type,
        config: { event_name: step.config.eventName }
      };
    case "delay":
      return {
        key: step.key,
        type: step.type,
        config: step.config
      };
    case "send_email":
      return {
        key: step.key,
        type: step.type,
        config: {
          template: step.config.template,
          subject: step.config.subject,
          from: step.config.from,
          reply_to: step.config.replyTo
        }
      };
    case "wait_for_event":
      return {
        key: step.key,
        type: step.type,
        config: {
          event_name: step.config.eventName,
          timeout: step.config.timeout,
          filter_rule: step.config.filterRule
        }
      };
    case "condition":
      return {
        key: step.key,
        type: step.type,
        config: step.config
      };
    case "contact_update":
      return {
        key: step.key,
        type: step.type,
        config: {
          first_name: step.config.firstName,
          last_name: step.config.lastName,
          unsubscribed: step.config.unsubscribed,
          properties: step.config.properties
        }
      };
    case "contact_delete":
      return {
        key: step.key,
        type: step.type,
        config: step.config
      };
    case "add_to_segment":
      return {
        key: step.key,
        type: step.type,
        config: { segment_id: step.config.segmentId }
      };
  }
}
function parseConnection(connection) {
  return {
    from: connection.from,
    to: connection.to,
    type: connection.type
  };
}
function parseAutomationToApiOptions(automation) {
  return {
    name: automation.name,
    status: automation.status,
    steps: automation.steps.map(parseStepConfig),
    connections: automation.connections.map(parseConnection)
  };
}
function parseEventToApiOptions(event) {
  return {
    event: event.event,
    contact_id: event.contactId,
    email: event.email,
    payload: event.payload
  };
}
var Automations = class {
  constructor(resend) {
    this.resend = resend;
    this.runs = new AutomationRuns(this.resend);
  }
  async create(payload) {
    return await this.resend.post("/automations", parseAutomationToApiOptions(payload));
  }
  async list(options = {}) {
    const params = [buildPaginationQuery(options)];
    if (options.status) params.push(`status=${encodeURIComponent(options.status)}`);
    const qs = params.filter(Boolean).join("&");
    const url = qs ? `/automations?${qs}` : "/automations";
    return await this.resend.get(url);
  }
  async get(id) {
    return await this.resend.get(`/automations/${id}`);
  }
  async remove(id) {
    return await this.resend.delete(`/automations/${id}`);
  }
  async update(id, payload) {
    const apiPayload = {};
    if (payload.name !== void 0) apiPayload.name = payload.name;
    if (payload.status !== void 0) apiPayload.status = payload.status;
    if (payload.steps !== void 0) apiPayload.steps = payload.steps.map(parseStepConfig);
    if (payload.connections !== void 0) apiPayload.connections = payload.connections.map(parseConnection);
    return await this.resend.patch(`/automations/${id}`, apiPayload);
  }
  async stop(id) {
    return await this.resend.post(`/automations/${id}/stop`);
  }
};
function parseAttachments(attachments) {
  return attachments?.map((attachment) => ({
    content: attachment.content,
    filename: attachment.filename,
    path: attachment.path,
    content_type: attachment.contentType,
    content_id: attachment.contentId
  }));
}
function parseEmailToApiOptions(email) {
  return {
    attachments: parseAttachments(email.attachments),
    bcc: email.bcc,
    cc: email.cc,
    from: email.from,
    headers: email.headers,
    html: email.html,
    reply_to: email.replyTo,
    scheduled_at: email.scheduledAt,
    subject: email.subject,
    tags: email.tags,
    text: email.text,
    to: email.to,
    template: email.template ? {
      id: email.template.id,
      variables: email.template.variables
    } : void 0,
    topic_id: email.topicId
  };
}
async function render(node) {
  let render2;
  try {
    ({ render: render2 } = await import("./render_resend_false_VXizwFaD.mjs"));
  } catch {
    throw new Error("Failed to render React component. Make sure to install `@react-email/render` or `@react-email/components`.");
  }
  return render2(node);
}
var Batch = class {
  constructor(resend) {
    this.resend = resend;
  }
  async send(payload, options) {
    return this.create(payload, options);
  }
  async create(payload, options) {
    const emails = [];
    for (const email of payload) {
      if (email.react) {
        email.html = await render(email.react);
        email.react = void 0;
      }
      emails.push(parseEmailToApiOptions(email));
    }
    return await this.resend.post("/emails/batch", emails, {
      ...options,
      headers: {
        "x-batch-validation": options?.batchValidation ?? "strict",
        ...options?.headers
      }
    });
  }
};
var Broadcasts = class {
  constructor(resend) {
    this.resend = resend;
  }
  async create(payload, options = {}) {
    const html = payload.react ? await render(payload.react) : payload.html;
    return await this.resend.post("/broadcasts", {
      name: payload.name,
      segment_id: payload.segmentId,
      audience_id: payload.audienceId,
      preview_text: payload.previewText,
      from: payload.from,
      html,
      reply_to: payload.replyTo,
      subject: payload.subject,
      text: payload.text,
      topic_id: payload.topicId,
      send: payload.send,
      scheduled_at: payload.scheduledAt
    }, options);
  }
  async send(id, payload) {
    return await this.resend.post(`/broadcasts/${id}/send`, { scheduled_at: payload?.scheduledAt });
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/broadcasts?${queryString}` : "/broadcasts";
    return await this.resend.get(url);
  }
  async get(id) {
    return await this.resend.get(`/broadcasts/${id}`);
  }
  async remove(id) {
    return await this.resend.delete(`/broadcasts/${id}`);
  }
  async update(id, payload) {
    const html = payload.react ? await render(payload.react) : payload.html;
    return await this.resend.patch(`/broadcasts/${id}`, {
      name: payload.name,
      segment_id: payload.segmentId,
      audience_id: payload.audienceId,
      from: payload.from,
      html,
      text: payload.text,
      subject: payload.subject,
      reply_to: payload.replyTo,
      preview_text: payload.previewText,
      topic_id: payload.topicId
    });
  }
};
function parseContactPropertyFromApi(contactProperty) {
  return {
    id: contactProperty.id,
    key: contactProperty.key,
    createdAt: contactProperty.created_at,
    type: contactProperty.type,
    fallbackValue: contactProperty.fallback_value
  };
}
function parseContactPropertyToApiOptions(contactProperty) {
  if ("key" in contactProperty) return {
    key: contactProperty.key,
    type: contactProperty.type,
    fallback_value: contactProperty.fallbackValue
  };
  return { fallback_value: contactProperty.fallbackValue };
}
var ContactProperties = class {
  constructor(resend) {
    this.resend = resend;
  }
  async create(options) {
    const apiOptions = parseContactPropertyToApiOptions(options);
    return await this.resend.post("/contact-properties", apiOptions);
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/contact-properties?${queryString}` : "/contact-properties";
    const response = await this.resend.get(url);
    if (response.data) return {
      data: {
        ...response.data,
        data: response.data.data.map((apiContactProperty) => parseContactPropertyFromApi(apiContactProperty))
      },
      headers: response.headers,
      error: null
    };
    return response;
  }
  async get(id) {
    if (!id) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    const response = await this.resend.get(`/contact-properties/${id}`);
    if (response.data) return {
      data: {
        object: "contact_property",
        ...parseContactPropertyFromApi(response.data)
      },
      headers: response.headers,
      error: null
    };
    return response;
  }
  async update(payload) {
    if (!payload.id) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    const apiOptions = parseContactPropertyToApiOptions(payload);
    return await this.resend.patch(`/contact-properties/${payload.id}`, apiOptions);
  }
  async remove(id) {
    if (!id) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    return await this.resend.delete(`/contact-properties/${id}`);
  }
};
var ContactSegments = class {
  constructor(resend) {
    this.resend = resend;
  }
  async list(options) {
    if (!options.contactId && !options.email) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` or `email` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    const identifier = options.email ? options.email : options.contactId;
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/contacts/${identifier}/segments?${queryString}` : `/contacts/${identifier}/segments`;
    return await this.resend.get(url);
  }
  async add(options) {
    if (!options.contactId && !options.email) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` or `email` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    const identifier = options.email ? options.email : options.contactId;
    return this.resend.post(`/contacts/${identifier}/segments/${options.segmentId}`);
  }
  async remove(options) {
    if (!options.contactId && !options.email) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` or `email` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    const identifier = options.email ? options.email : options.contactId;
    return this.resend.delete(`/contacts/${identifier}/segments/${options.segmentId}`);
  }
};
var ContactTopics = class {
  constructor(resend) {
    this.resend = resend;
  }
  async update(payload) {
    if (!payload.id && !payload.email) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` or `email` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    const identifier = payload.email ? payload.email : payload.id;
    return this.resend.patch(`/contacts/${identifier}/topics`, payload.topics);
  }
  async list(options) {
    if (!options.id && !options.email) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` or `email` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    const identifier = options.email ? options.email : options.id;
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/contacts/${identifier}/topics?${queryString}` : `/contacts/${identifier}/topics`;
    return this.resend.get(url);
  }
};
var Contacts = class {
  constructor(resend) {
    this.resend = resend;
    this.topics = new ContactTopics(this.resend);
    this.segments = new ContactSegments(this.resend);
  }
  async create(payload, options = {}) {
    if ("audienceId" in payload) {
      if ("segments" in payload || "topics" in payload) return {
        data: null,
        headers: null,
        error: {
          message: "`audienceId` is deprecated, and cannot be used together with `segments` or `topics`. Use `segments` instead to add one or more segments to the new contact.",
          statusCode: null,
          name: "invalid_parameter"
        }
      };
      return await this.resend.post(`/audiences/${payload.audienceId}/contacts`, {
        unsubscribed: payload.unsubscribed,
        email: payload.email,
        first_name: payload.firstName,
        last_name: payload.lastName,
        properties: payload.properties
      }, options);
    }
    return await this.resend.post("/contacts", {
      unsubscribed: payload.unsubscribed,
      email: payload.email,
      first_name: payload.firstName,
      last_name: payload.lastName,
      properties: payload.properties,
      segments: payload.segments,
      topics: payload.topics
    }, options);
  }
  async list(options = {}) {
    const segmentId = options.segmentId ?? options.audienceId;
    if (!segmentId) {
      const queryString2 = buildPaginationQuery(options);
      const url2 = queryString2 ? `/contacts?${queryString2}` : "/contacts";
      return await this.resend.get(url2);
    }
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/segments/${segmentId}/contacts?${queryString}` : `/segments/${segmentId}/contacts`;
    return await this.resend.get(url);
  }
  async get(options) {
    if (typeof options === "string") return this.resend.get(`/contacts/${options}`);
    if (!options.id && !options.email) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` or `email` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    if (!options.audienceId) return this.resend.get(`/contacts/${options?.email ? options?.email : options?.id}`);
    return this.resend.get(`/audiences/${options.audienceId}/contacts/${options?.email ? options?.email : options?.id}`);
  }
  async update(options) {
    if (!options.id && !options.email) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` or `email` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    if (!options.audienceId) return await this.resend.patch(`/contacts/${options?.email ? options?.email : options?.id}`, {
      unsubscribed: options.unsubscribed,
      first_name: options.firstName,
      last_name: options.lastName,
      properties: options.properties
    });
    return await this.resend.patch(`/audiences/${options.audienceId}/contacts/${options?.email ? options?.email : options?.id}`, {
      unsubscribed: options.unsubscribed,
      first_name: options.firstName,
      last_name: options.lastName,
      properties: options.properties
    });
  }
  async remove(payload) {
    if (typeof payload === "string") return this.resend.delete(`/contacts/${payload}`);
    if (!payload.id && !payload.email) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` or `email` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    if (!payload.audienceId) return this.resend.delete(`/contacts/${payload?.email ? payload?.email : payload?.id}`);
    return this.resend.delete(`/audiences/${payload.audienceId}/contacts/${payload?.email ? payload?.email : payload?.id}`);
  }
};
function parseDomainToApiOptions(domain) {
  return {
    name: domain.name,
    region: domain.region,
    custom_return_path: domain.customReturnPath,
    capabilities: domain.capabilities,
    open_tracking: domain.openTracking,
    click_tracking: domain.clickTracking,
    tls: domain.tls,
    tracking_subdomain: domain.trackingSubdomain
  };
}
var Domains = class {
  constructor(resend) {
    this.resend = resend;
  }
  async create(payload, options = {}) {
    return await this.resend.post("/domains", parseDomainToApiOptions(payload), options);
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/domains?${queryString}` : "/domains";
    return await this.resend.get(url);
  }
  async get(id) {
    return await this.resend.get(`/domains/${id}`);
  }
  async update(payload) {
    return await this.resend.patch(`/domains/${payload.id}`, {
      click_tracking: payload.clickTracking,
      open_tracking: payload.openTracking,
      tls: payload.tls,
      capabilities: payload.capabilities,
      tracking_subdomain: payload.trackingSubdomain
    });
  }
  async remove(id) {
    return await this.resend.delete(`/domains/${id}`);
  }
  async verify(id) {
    return await this.resend.post(`/domains/${id}/verify`);
  }
};
var Attachments$1 = class {
  constructor(resend) {
    this.resend = resend;
  }
  async get(options) {
    const { emailId, id } = options;
    return await this.resend.get(`/emails/${emailId}/attachments/${id}`);
  }
  async list(options) {
    const { emailId } = options;
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/emails/${emailId}/attachments?${queryString}` : `/emails/${emailId}/attachments`;
    return await this.resend.get(url);
  }
};
var Attachments = class {
  constructor(resend) {
    this.resend = resend;
  }
  async get(options) {
    const { emailId, id } = options;
    return await this.resend.get(`/emails/receiving/${emailId}/attachments/${id}`);
  }
  async list(options) {
    const { emailId } = options;
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/emails/receiving/${emailId}/attachments?${queryString}` : `/emails/receiving/${emailId}/attachments`;
    return await this.resend.get(url);
  }
};
var Receiving = class {
  constructor(resend) {
    this.resend = resend;
    this.attachments = new Attachments(resend);
  }
  async get(id) {
    return await this.resend.get(`/emails/receiving/${id}`);
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/emails/receiving?${queryString}` : "/emails/receiving";
    return await this.resend.get(url);
  }
  async forward(options) {
    const { emailId, to, from } = options;
    const passthrough = options.passthrough !== false;
    const emailResponse = await this.get(emailId);
    if (emailResponse.error) return {
      data: null,
      error: emailResponse.error,
      headers: emailResponse.headers
    };
    const email = emailResponse.data;
    const originalSubject = email.subject || "(no subject)";
    if (passthrough) return this.forwardPassthrough(email, {
      to,
      from,
      subject: originalSubject
    });
    const forwardSubject = originalSubject.startsWith("Fwd:") ? originalSubject : `Fwd: ${originalSubject}`;
    return this.forwardWrapped(email, {
      to,
      from,
      subject: forwardSubject,
      text: "text" in options ? options.text : void 0,
      html: "html" in options ? options.html : void 0
    });
  }
  async forwardPassthrough(email, options) {
    const { to, from, subject } = options;
    if (!email.raw?.download_url) return {
      data: null,
      error: {
        name: "validation_error",
        message: "Raw email content is not available for this email",
        statusCode: 400
      },
      headers: null
    };
    const rawResponse = await fetch(email.raw.download_url);
    if (!rawResponse.ok) return {
      data: null,
      error: {
        name: "application_error",
        message: "Failed to download raw email content",
        statusCode: rawResponse.status
      },
      headers: null
    };
    const rawEmailContent = await rawResponse.text();
    const parsed = await PostalMime.parse(rawEmailContent, { attachmentEncoding: "base64" });
    const attachments = parsed.attachments.map((attachment) => {
      const contentId = attachment.contentId ? attachment.contentId.replace(/^<|>$/g, "") : void 0;
      return {
        filename: attachment.filename,
        content: attachment.content.toString(),
        content_type: attachment.mimeType,
        content_id: contentId || void 0
      };
    });
    return await this.resend.post("/emails", {
      from,
      to,
      subject,
      text: parsed.text || void 0,
      html: parsed.html || void 0,
      attachments: attachments.length > 0 ? attachments : void 0
    });
  }
  async forwardWrapped(email, options) {
    const { to, from, subject, text, html } = options;
    if (!email.raw?.download_url) return {
      data: null,
      error: {
        name: "validation_error",
        message: "Raw email content is not available for this email",
        statusCode: 400
      },
      headers: null
    };
    const rawResponse = await fetch(email.raw.download_url);
    if (!rawResponse.ok) return {
      data: null,
      error: {
        name: "application_error",
        message: "Failed to download raw email content",
        statusCode: rawResponse.status
      },
      headers: null
    };
    const rawEmailContent = await rawResponse.text();
    return await this.resend.post("/emails", {
      from,
      to,
      subject,
      text,
      html,
      attachments: [{
        filename: "forwarded_message.eml",
        content: Buffer.from(rawEmailContent).toString("base64"),
        content_type: "message/rfc822"
      }]
    });
  }
};
var Emails = class {
  constructor(resend) {
    this.resend = resend;
    this.attachments = new Attachments$1(resend);
    this.receiving = new Receiving(resend);
  }
  async send(payload, options = {}) {
    return this.create(payload, options);
  }
  async create(payload, options = {}) {
    const body = { ...payload };
    if (payload.react) body.html = await render(payload.react);
    return await this.resend.post("/emails", parseEmailToApiOptions(body), options);
  }
  async get(id) {
    return await this.resend.get(`/emails/${id}`);
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/emails?${queryString}` : "/emails";
    return await this.resend.get(url);
  }
  async update(payload) {
    return await this.resend.patch(`/emails/${payload.id}`, { scheduled_at: payload.scheduledAt });
  }
  async cancel(id) {
    return await this.resend.post(`/emails/${id}/cancel`);
  }
};
var Events = class {
  constructor(resend) {
    this.resend = resend;
  }
  async send(payload) {
    return await this.resend.post("/events/send", parseEventToApiOptions(payload));
  }
  async create(payload) {
    return await this.resend.post("/events", payload);
  }
  async get(identifier) {
    return await this.resend.get(`/events/${encodeURIComponent(identifier)}`);
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/events?${queryString}` : "/events";
    return await this.resend.get(url);
  }
  async update(identifier, payload) {
    return await this.resend.patch(`/events/${encodeURIComponent(identifier)}`, payload);
  }
  async remove(identifier) {
    return await this.resend.delete(`/events/${encodeURIComponent(identifier)}`);
  }
};
var Logs = class {
  constructor(resend) {
    this.resend = resend;
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/logs?${queryString}` : "/logs";
    return await this.resend.get(url);
  }
  async get(id) {
    return await this.resend.get(`/logs/${id}`);
  }
};
var Segments = class {
  constructor(resend) {
    this.resend = resend;
  }
  async create(payload, options = {}) {
    return await this.resend.post("/segments", payload, options);
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/segments?${queryString}` : "/segments";
    return await this.resend.get(url);
  }
  async get(id) {
    return await this.resend.get(`/segments/${id}`);
  }
  async remove(id) {
    return await this.resend.delete(`/segments/${id}`);
  }
};
function getPaginationQueryProperties(options = {}) {
  const query = new URLSearchParams();
  if (options.before) query.set("before", options.before);
  if (options.after) query.set("after", options.after);
  if (options.limit) query.set("limit", options.limit.toString());
  return query.size > 0 ? `?${query.toString()}` : "";
}
function parseVariables(variables) {
  return variables?.map((variable) => ({
    key: variable.key,
    type: variable.type,
    fallback_value: variable.fallbackValue
  }));
}
function parseTemplateToApiOptions(template) {
  return {
    name: "name" in template ? template.name : void 0,
    subject: template.subject,
    html: template.html,
    text: template.text,
    alias: template.alias,
    from: template.from,
    reply_to: template.replyTo,
    variables: parseVariables(template.variables)
  };
}
var ChainableTemplateResult = class {
  constructor(promise, publishFn) {
    this.promise = promise;
    this.publishFn = publishFn;
  }
  then(onfulfilled, onrejected) {
    return this.promise.then(onfulfilled, onrejected);
  }
  async publish() {
    const { data, error } = await this.promise;
    if (error) return {
      data: null,
      headers: null,
      error
    };
    return this.publishFn(data.id);
  }
};
var Templates = class {
  constructor(resend) {
    this.resend = resend;
  }
  create(payload) {
    return new ChainableTemplateResult(this.performCreate(payload), this.publish.bind(this));
  }
  async performCreate(payload) {
    const body = { ...payload };
    if (payload.react) body.html = await render(payload.react);
    return this.resend.post("/templates", parseTemplateToApiOptions(body));
  }
  async remove(identifier) {
    return await this.resend.delete(`/templates/${identifier}`);
  }
  async get(identifier) {
    return await this.resend.get(`/templates/${identifier}`);
  }
  async list(options = {}) {
    return this.resend.get(`/templates${getPaginationQueryProperties(options)}`);
  }
  duplicate(identifier) {
    return new ChainableTemplateResult(this.resend.post(`/templates/${identifier}/duplicate`), this.publish.bind(this));
  }
  async publish(identifier) {
    return await this.resend.post(`/templates/${identifier}/publish`);
  }
  async update(identifier, payload) {
    return await this.resend.patch(`/templates/${identifier}`, parseTemplateToApiOptions(payload));
  }
};
var Topics = class {
  constructor(resend) {
    this.resend = resend;
  }
  async create(payload) {
    const { defaultSubscription, ...body } = payload;
    return await this.resend.post("/topics", {
      ...body,
      default_subscription: defaultSubscription
    });
  }
  async list() {
    return await this.resend.get("/topics");
  }
  async get(id) {
    if (!id) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    return await this.resend.get(`/topics/${id}`);
  }
  async update(payload) {
    if (!payload.id) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    return await this.resend.patch(`/topics/${payload.id}`, payload);
  }
  async remove(id) {
    if (!id) return {
      data: null,
      headers: null,
      error: {
        message: "Missing `id` field.",
        statusCode: null,
        name: "missing_required_field"
      }
    };
    return await this.resend.delete(`/topics/${id}`);
  }
};
var Webhooks = class {
  constructor(resend) {
    this.resend = resend;
  }
  async create(payload, options = {}) {
    return await this.resend.post("/webhooks", payload, options);
  }
  async get(id) {
    return await this.resend.get(`/webhooks/${id}`);
  }
  async list(options = {}) {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/webhooks?${queryString}` : "/webhooks";
    return await this.resend.get(url);
  }
  async update(id, payload) {
    return await this.resend.patch(`/webhooks/${id}`, payload);
  }
  async remove(id) {
    return await this.resend.delete(`/webhooks/${id}`);
  }
  verify(payload) {
    return new distExports.Webhook(payload.webhookSecret).verify(payload.payload, {
      "webhook-id": payload.headers.id,
      "webhook-timestamp": payload.headers.timestamp,
      "webhook-signature": payload.headers.signature
    });
  }
};
const defaultBaseUrl = "https://api.resend.com";
const defaultUserAgent = `resend-node:${version}`;
function getDefaultBaseUrl() {
  return typeof process !== "undefined" && define_process_env_default ? define_process_env_default.RESEND_BASE_URL || defaultBaseUrl : defaultBaseUrl;
}
function getDefaultUserAgent() {
  return typeof process !== "undefined" && define_process_env_default ? define_process_env_default.RESEND_USER_AGENT || defaultUserAgent : defaultUserAgent;
}
var Resend = class {
  constructor(key, options) {
    this.key = key;
    this.segments = new Segments(this);
    this.apiKeys = new ApiKeys(this);
    this.audiences = this.segments;
    this.automations = new Automations(this);
    this.batch = new Batch(this);
    this.broadcasts = new Broadcasts(this);
    this.contactProperties = new ContactProperties(this);
    this.contacts = new Contacts(this);
    this.domains = new Domains(this);
    this.emails = new Emails(this);
    this.events = new Events(this);
    this.logs = new Logs(this);
    this.templates = new Templates(this);
    this.topics = new Topics(this);
    this.webhooks = new Webhooks(this);
    if (!key) {
      if (typeof process !== "undefined" && define_process_env_default) this.key = define_process_env_default.RESEND_API_KEY;
      if (!this.key) throw new Error('Missing API key. Pass it to the constructor `new Resend("re_123")`');
    }
    this.baseUrl = options?.baseUrl ?? getDefaultBaseUrl();
    this.userAgent = options?.userAgent ?? getDefaultUserAgent();
    this.headers = new Headers({
      Authorization: `Bearer ${this.key}`,
      "User-Agent": this.userAgent,
      "Content-Type": "application/json"
    });
  }
  async fetchRequest(path, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, options);
      if (!response.ok) try {
        const rawError = await response.text();
        return {
          data: null,
          error: JSON.parse(rawError),
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (err) {
        if (err instanceof SyntaxError) return {
          data: null,
          error: {
            name: "application_error",
            statusCode: response.status,
            message: "Internal server error. We are unable to process your request right now, please try again later."
          },
          headers: Object.fromEntries(response.headers.entries())
        };
        const error = {
          message: response.statusText,
          statusCode: response.status,
          name: "application_error"
        };
        if (err instanceof Error) return {
          data: null,
          error: {
            ...error,
            message: err.message
          },
          headers: Object.fromEntries(response.headers.entries())
        };
        return {
          data: null,
          error,
          headers: Object.fromEntries(response.headers.entries())
        };
      }
      return {
        data: await response.json(),
        error: null,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch {
      return {
        data: null,
        error: {
          name: "application_error",
          statusCode: null,
          message: "Unable to fetch data. The request could not be resolved."
        },
        headers: null
      };
    }
  }
  async post(path, entity, options = {}) {
    const headers = new Headers(this.headers);
    if (options.headers) for (const [key, value] of new Headers(options.headers).entries()) headers.set(key, value);
    if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
    const requestOptions = {
      method: "POST",
      body: JSON.stringify(entity),
      ...options,
      headers
    };
    return this.fetchRequest(path, requestOptions);
  }
  async get(path, options = {}) {
    const headers = new Headers(this.headers);
    if (options.headers) for (const [key, value] of new Headers(options.headers).entries()) headers.set(key, value);
    const requestOptions = {
      method: "GET",
      ...options,
      headers
    };
    return this.fetchRequest(path, requestOptions);
  }
  async put(path, entity, options = {}) {
    const headers = new Headers(this.headers);
    if (options.headers) for (const [key, value] of new Headers(options.headers).entries()) headers.set(key, value);
    const requestOptions = {
      method: "PUT",
      body: JSON.stringify(entity),
      ...options,
      headers
    };
    return this.fetchRequest(path, requestOptions);
  }
  async patch(path, entity, options = {}) {
    const headers = new Headers(this.headers);
    if (options.headers) for (const [key, value] of new Headers(options.headers).entries()) headers.set(key, value);
    const requestOptions = {
      method: "PATCH",
      body: JSON.stringify(entity),
      ...options,
      headers
    };
    return this.fetchRequest(path, requestOptions);
  }
  async delete(path, query, options = {}) {
    const headers = new Headers(this.headers);
    if (options.headers) for (const [key, value] of new Headers(options.headers).entries()) headers.set(key, value);
    const requestOptions = {
      method: "DELETE",
      body: query === void 0 ? void 0 : JSON.stringify(query),
      ...options,
      headers
    };
    return this.fetchRequest(path, requestOptions);
  }
};
const prerender = false;
const TO_EMAIL = "hello@bluebook.hk";
const FROM_EMAIL = "no-reply@bluebook.hk";
const RESEND_API_KEY = "";
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      name,
      email,
      company,
      phone,
      serviceInterest,
      message,
      consent
    } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return new Response(JSON.stringify({ success: false, error: "Name is required." }), { status: 400 });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, error: "A valid email address is required." }), { status: 400 });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ success: false, error: "A message is required." }), { status: 400 });
    }
    if (!consent) {
      return new Response(JSON.stringify({ success: false, error: "Consent is required." }), { status: 400 });
    }
    if (body._hp && body._hp.length > 0) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    const fields = [
      ["Name", name],
      ["Email", email],
      ["Company", company || "—"],
      ["Phone", phone || "—"],
      ["Service Interest", serviceInterest || "—"],
      ["Message", message]
    ];
    const rows = fields.map(([label, value]) => `<strong>${label}:</strong> ${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}`).join("<br>\n");
    const html = `<h2>New Bluebook Contact Enquiry</h2><p>${rows}</p>`;
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "Email service not configured." }), { status: 500 });
    }
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: "New Bluebook Contact Enquiry",
      html
    });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("Contact API error:", err);
    return new Response(JSON.stringify({ success: false, error: "Failed to send message. Please try again or email us directly." }), { status: 500 });
  }
};
const _page = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: "Module" }));
const page = () => _page;
export {
  page
};
