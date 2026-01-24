import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Section,
  Text,
  Button,
} from "@react-email/components";
import * as React from "react";

interface CourseMismatchEmailProps {
  username: string;
  date: string;
  session: string;
  manualCourseName: string;
  courseLabel: string;
  dashboardUrl: string;
}

export const CourseMismatchEmail = ({
  username,
  date,
  session,
  manualCourseName,
  courseLabel,
  dashboardUrl,
}: CourseMismatchEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerText}>GhostClass 👻</Heading>
        </Section>

        <Section style={content}>
          <Heading style={title}>Course Mismatch Detected</Heading>

          <Text style={paragraph}>
            Hi <strong>{username}</strong>,<br />
            We noticed a mix-up. You self-recorded a class for one course, but
            the official record shows a different one for that time slot.
          </Text>

          <Section style={conflictBox}>
            <table style={table}>
              <tbody>
                <tr>
                  <td style={tableCellLabel}>📅 Date</td>
                  <td style={tableCellValue}>
                    {date} - ({session})
                  </td>
                </tr>
                <tr>
                  <td style={tableCellLabel}>👤 You Marked</td>
                  <td style={tableCellValueBold}>{manualCourseName}</td>
                </tr>
                <tr>
                  <td style={tableCellLabelLast}>🏫 Official Record</td>
                  <td style={tableCellValueBoldLast}>{courseLabel}</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Text style={note}>
            To prevent confusion, we have{" "}
            <strong>removed your manual entry</strong>. Please check your
            dashboard for the correct status.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              Open Dashboard
            </Button>
          </Section>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>GhostClass 👻</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default CourseMismatchEmail;

// Styles
const main = {
  fontFamily:
    "'Helvetica Neue', Helvetica, Arial, sans-serif",
  backgroundColor: "#f3f4f6",
  margin: "0",
  padding: "40px 0",
};

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden",
  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
  border: "1px solid #e5e7eb",
};

const header = {
  background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
  padding: "32px 20px",
  textAlign: "center" as const,
};

const headerText = {
  color: "#ffffff",
  margin: "0",
  fontSize: "24px",
  fontWeight: "700",
  letterSpacing: "-0.5px",
};

const content = {
  padding: "40px 30px",
};

const title = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: "600",
  marginTop: "0",
  marginBottom: "16px",
};

const paragraph = {
  color: "#4b5563",
  fontSize: "16px",
  lineHeight: "1.6",
  marginBottom: "24px",
};

const conflictBox = {
  backgroundColor: "#fff1f2",
  border: "1px solid #fecdd3",
  borderRadius: "8px",
  padding: "20px",
};

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const tableCellLabel = {
  padding: "8px 0",
  borderBottom: "1px solid #ffe4e6",
  color: "#be123c",
  fontSize: "14px",
  fontWeight: "600",
};

const tableCellLabelLast = {
  padding: "8px 0",
  color: "#be123c",
  fontSize: "14px",
  fontWeight: "600",
};

const tableCellValue = {
  padding: "8px 0",
  borderBottom: "1px solid #ffe4e6",
  color: "#111827",
  textAlign: "right" as const,
  fontSize: "14px",
};

const tableCellValueBold = {
  padding: "8px 0",
  borderBottom: "1px solid #ffe4e6",
  color: "#111827",
  textAlign: "right" as const,
  fontSize: "14px",
  fontWeight: "500",
};

const tableCellValueBoldLast = {
  padding: "8px 0",
  color: "#111827",
  textAlign: "right" as const,
  fontSize: "14px",
  fontWeight: "700",
};

const note = {
  color: "#6b7280",
  fontSize: "14px",
  marginTop: "24px",
  lineHeight: "1.5",
  textAlign: "center" as const,
};

const buttonContainer = {
  textAlign: "center" as const,
  marginTop: "32px",
};

const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 32px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "bold",
  fontSize: "16px",
  display: "inline-block",
  boxShadow: "0 4px 6px rgba(124, 58, 237, 0.25)",
};

const footer = {
  backgroundColor: "#f9fafb",
  padding: "20px",
  textAlign: "center" as const,
  borderTop: "1px solid #e5e7eb",
};

const footerText = {
  color: "#9ca3af",
  fontSize: "12px",
  margin: "0",
};
