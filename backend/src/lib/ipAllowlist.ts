const normalizeIp = (ip: string) => ip.replace("::ffff:", "");

const ipv4ToNumber = (ip: string) =>
  ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;

const isInCidr = (ip: string, cidr: string) => {
  const [range, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);

  if (!range || Number.isNaN(bits)) {
    return false;
  }

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(range) & mask);
};

export const isIpAllowed = (ip: string | undefined, allowlist: string[]) => {
  if (!allowlist.length) {
    return true;
  }

  if (!ip) {
    return false;
  }

  const normalized = normalizeIp(ip);

  return allowlist.some((entry) =>
    entry.includes("/") ? isInCidr(normalized, entry) : normalizeIp(entry) === normalized
  );
};
