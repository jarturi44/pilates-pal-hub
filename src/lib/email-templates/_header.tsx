import { Img, Section } from "@react-email/components";
import { LOGO_URL, SITE_NAME } from "./_styles";

export function EmailHeader() {
  return (
    <Section style={{ textAlign: "center", padding: "8px 0 24px" }}>
      <Img
        src={LOGO_URL}
        alt={SITE_NAME}
        width="64"
        height="64"
        style={{ display: "inline-block", borderRadius: "8px" }}
      />
    </Section>
  );
}
