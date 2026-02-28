/**
 * Terms and Conditions content per deployment mode.
 * Used on public /terms/[mode] and /terms/accept pages.
 */

export type TermsMode = "sis" | "lms" | "hybrid";

export const TERMS_MODE_LABELS: Record<TermsMode, string> = {
  sis: "Student Information System (SIS)",
  lms: "Learning Management System (LMS)",
  hybrid: "Hybrid (SIS + LMS)",
};

export function getTermsContent(mode: TermsMode): { title: string; content: string } {
  switch (mode) {
    case "sis":
      return { title: "Terms & Conditions — SIS", content: TERMS_SIS };
    case "lms":
      return { title: "Terms & Conditions — LMS", content: TERMS_LMS };
    case "hybrid":
      return { title: "Terms & Conditions — Hybrid (SIS + LMS)", content: TERMS_HYBRID };
    default:
      return { title: "Terms & Conditions", content: TERMS_LMS };
  }
}

const TERMS_SIS = `
SILS — STUDENT INFORMATION SYSTEM (SIS)  
PLATFORM TERMS AND CONDITIONS  
Last updated: [Date]

1. AGREEMENT AND ACCEPTANCE

These Terms and Conditions ("Terms") govern your institution's use of the SILS Student Information System ("SIS") platform ("Platform") operated by [Operator] ("we", "us", "our"). By accepting these Terms, the institution ("you", "your", "Institution") agrees to be bound by them. The individual accepting on behalf of the Institution represents that they have authority to bind the Institution.

2. FINANCIAL OBLIGATIONS AND VERIFICATION

2.1 The Institution must meet all financial requirements specified in the Order Form or commercial agreement, including but not limited to: (a) payment of applicable subscription fees; (b) any one-time setup or implementation fees; (c) payment terms (e.g., annual in advance, monthly); and (d) valid payment method on file.

2.2 We reserve the right to verify the Institution's financial standing and payment capability before activating or continuing access to the Platform. Failure to meet financial requirements may result in suspension or termination of access.

2.3 Fees are non-refundable except as expressly stated in the agreement. Price changes will be communicated in advance and apply at renewal unless otherwise agreed.

3. SIS DEPLOYMENT – SCOPE OF USE

3.1 The SIS deployment provides student information management capabilities only, including: enrollment, academic records, grading, attendance, reporting, and related administrative functions. It does not include learning management (LMS) features such as course delivery, assignments, or content authoring unless you have a Hybrid deployment.

3.2 The Institution shall use the Platform solely for its own internal educational operations and in compliance with all applicable laws, including data protection (e.g., FERPA, GDPR where applicable) and student privacy regulations.

3.3 The Institution is responsible for: (a) accuracy of data entered; (b) configuring roles and permissions; (c) training staff; and (d) maintaining appropriate security of its account credentials.

4. DATA, PRIVACY, AND SECURITY

4.1 We process Institution Data as a processor (or service provider) under applicable data protection law. The Institution remains the controller of Institution Data. Our Data Processing Agreement and Privacy Policy apply.

4.2 The Institution shall not upload or process data that it does not have the right to use, or that violates any law or third-party right. We may suspend or terminate access if we reasonably believe the Institution has violated this section.

4.3 We implement industry-standard technical and organizational measures to protect the Platform and data. The Institution must promptly notify us of any suspected breach or unauthorized access.

5. INTELLECTUAL PROPERTY AND RESTRICTIONS

5.1 We retain all rights in the Platform, including software, design, and documentation. The Institution receives a limited, non-exclusive, non-transferable right to use the Platform during the subscription term.

5.2 The Institution must not: reverse engineer the Platform; remove any proprietary notices; sublicense or resell the Platform; use it to build a competing product; or exceed authorized usage (e.g., user counts, storage limits).

6. TERM, SUSPENSION, AND TERMINATION

6.1 The term is as set forth in the Order Form. Either party may terminate for material breach that remains uncured after 30 days' written notice, or as otherwise permitted in the agreement.

6.2 We may suspend access immediately for: (a) non-payment; (b) violation of these Terms or law; (c) security or integrity concerns; or (d) to comply with law. We will use reasonable efforts to give advance notice where practicable.

6.3 Upon termination, the Institution's right to use the Platform ceases. We may retain and delete data in accordance with our data retention policy and applicable law.

7. DISCLAIMER AND LIMITATION OF LIABILITY

7.1 THE PLATFORM IS PROVIDED "AS IS". WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION.

7.2 TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR AGGREGATE LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE FEES PAID BY THE INSTITUTION IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. WE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.

8. INDEMNIFICATION

The Institution shall indemnify and hold us harmless from claims, damages, and costs (including reasonable attorneys' fees) arising from: (a) the Institution's use of the Platform; (b) Institution Data; or (c) the Institution's breach of these Terms, except to the extent caused by our gross negligence or willful misconduct.

9. GENERAL

9.1 These Terms, together with the Order Form, Data Processing Agreement, and Privacy Policy, constitute the entire agreement. Amendments must be in writing. Our failure to enforce any right does not waive that right.

9.2 Governing law and jurisdiction are as set forth in the commercial agreement. If any provision is held invalid, the remainder remains in effect.

9.3 The Institution must accept these Terms before gaining access to the Platform. Continued use constitutes ongoing acceptance.
`;

const TERMS_LMS = `
SILS — LEARNING MANAGEMENT SYSTEM (LMS)  
PLATFORM TERMS AND CONDITIONS  
Last updated: [Date]

1. AGREEMENT AND ACCEPTANCE

These Terms and Conditions ("Terms") govern your institution's use of the SILS Learning Management System ("LMS") platform ("Platform") operated by [Operator] ("we", "us", "our"). By accepting these Terms, the institution ("you", "your", "Institution") agrees to be bound by them. The individual accepting on behalf of the Institution represents that they have authority to bind the Institution.

2. FINANCIAL OBLIGATIONS AND VERIFICATION

2.1 The Institution must meet all financial requirements specified in the Order Form or commercial agreement, including but not limited to: (a) payment of applicable subscription fees; (b) any one-time setup or implementation fees; (c) payment terms (e.g., annual in advance, monthly); and (d) valid payment method on file.

2.2 We reserve the right to verify the Institution's financial standing and payment capability before activating or continuing access to the Platform. Failure to meet financial requirements may result in suspension or termination of access.

2.3 Fees are non-refundable except as expressly stated in the agreement. Price changes will be communicated in advance and apply at renewal unless otherwise agreed.

3. LMS DEPLOYMENT – SCOPE OF USE

3.1 The LMS deployment provides learning management capabilities, including: course creation and delivery, assignments, assessments, grading, discussions, content authoring, and learner engagement tools. It does not include full student information system (SIS) features such as institutional enrollment or transcript management unless you have a Hybrid deployment.

3.2 The Institution shall use the Platform solely for its own internal educational operations and in compliance with all applicable laws, including data protection (e.g., FERPA, GDPR where applicable) and student privacy regulations.

3.3 The Institution is responsible for: (a) accuracy of content and data; (b) configuring courses and access; (c) training instructors and learners; and (d) maintaining appropriate security of account credentials.

4. DATA, PRIVACY, AND SECURITY

4.1 We process Institution Data as a processor (or service provider) under applicable data protection law. The Institution remains the controller of Institution Data. Our Data Processing Agreement and Privacy Policy apply.

4.2 The Institution shall not upload or process data that it does not have the right to use, or that violates any law or third-party right (including copyright). We may suspend or terminate access if we reasonably believe the Institution has violated this section.

4.3 We implement industry-standard technical and organizational measures to protect the Platform and data. The Institution must promptly notify us of any suspected breach or unauthorized access.

5. INTELLECTUAL PROPERTY AND RESTRICTIONS

5.1 We retain all rights in the Platform. The Institution retains rights in its own content. The Institution grants us a license to host, store, and process Institution content solely to provide the Platform. The Institution receives a limited, non-exclusive, non-transferable right to use the Platform during the subscription term.

5.2 The Institution must not: reverse engineer the Platform; remove any proprietary notices; sublicense or resell the Platform; use it to build a competing product; or exceed authorized usage (e.g., user counts, storage, API limits).

6. TERM, SUSPENSION, AND TERMINATION

6.1 The term is as set forth in the Order Form. Either party may terminate for material breach that remains uncured after 30 days' written notice, or as otherwise permitted in the agreement.

6.2 We may suspend access immediately for: (a) non-payment; (b) violation of these Terms or law; (c) security or integrity concerns; or (d) to comply with law. We will use reasonable efforts to give advance notice where practicable.

6.3 Upon termination, the Institution's right to use the Platform ceases. Data export and retention are as set forth in our data retention policy and applicable law.

7. DISCLAIMER AND LIMITATION OF LIABILITY

7.1 THE PLATFORM IS PROVIDED "AS IS". WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION.

7.2 TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR AGGREGATE LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE FEES PAID BY THE INSTITUTION IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. WE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.

8. INDEMNIFICATION

The Institution shall indemnify and hold us harmless from claims, damages, and costs (including reasonable attorneys' fees) arising from: (a) the Institution's use of the Platform; (b) Institution Data or content; or (c) the Institution's breach of these Terms, except to the extent caused by our gross negligence or willful misconduct.

9. GENERAL

9.1 These Terms, together with the Order Form, Data Processing Agreement, and Privacy Policy, constitute the entire agreement. Amendments must be in writing. Our failure to enforce any right does not waive that right.

9.2 Governing law and jurisdiction are as set forth in the commercial agreement. If any provision is held invalid, the remainder remains in effect.

9.3 The Institution must accept these Terms before gaining access to the Platform. Continued use constitutes ongoing acceptance.
`;

const TERMS_HYBRID = `
SILS — HYBRID (SIS + LMS)  
PLATFORM TERMS AND CONDITIONS  
Last updated: [Date]

1. AGREEMENT AND ACCEPTANCE

These Terms and Conditions ("Terms") govern your institution's use of the SILS Hybrid platform combining the Student Information System ("SIS") and Learning Management System ("LMS") ("Platform") operated by [Operator] ("we", "us", "our"). By accepting these Terms, the institution ("you", "your", "Institution") agrees to be bound by them. The individual accepting on behalf of the Institution represents that they have authority to bind the Institution.

2. FINANCIAL OBLIGATIONS AND VERIFICATION

2.1 The Institution must meet all financial requirements specified in the Order Form or commercial agreement, including but not limited to: (a) payment of applicable subscription fees for the Hybrid deployment; (b) any one-time setup, integration, or implementation fees; (c) payment terms (e.g., annual in advance, monthly); and (d) valid payment method on file.

2.2 We reserve the right to verify the Institution's financial standing and payment capability before activating or continuing access to the Platform. Failure to meet financial requirements may result in suspension or termination of access.

2.3 Fees are non-refundable except as expressly stated in the agreement. Price changes will be communicated in advance and apply at renewal unless otherwise agreed.

3. HYBRID DEPLOYMENT – SCOPE OF USE

3.1 The Hybrid deployment includes both: (a) SIS capabilities (enrollment, academic records, grading, attendance, reporting, administrative functions); and (b) LMS capabilities (course delivery, assignments, assessments, content authoring, learner engagement). Data may be shared between SIS and LMS modules as designed and configured.

3.2 The Institution shall use the Platform solely for its own internal educational operations and in compliance with all applicable laws, including data protection (e.g., FERPA, GDPR where applicable) and student privacy regulations.

3.3 The Institution is responsible for: (a) accuracy of data and content; (b) configuring roles, permissions, and integrations between SIS and LMS; (c) training staff, instructors, and learners; and (d) maintaining appropriate security of account credentials.

4. DATA, PRIVACY, AND SECURITY

4.1 We process Institution Data as a processor (or service provider) under applicable data protection law. The Institution remains the controller of Institution Data. Our Data Processing Agreement and Privacy Policy apply. Data may be processed across SIS and LMS components as necessary to provide the Hybrid service.

4.2 The Institution shall not upload or process data that it does not have the right to use, or that violates any law or third-party right. We may suspend or terminate access if we reasonably believe the Institution has violated this section.

4.3 We implement industry-standard technical and organizational measures to protect the Platform and data. The Institution must promptly notify us of any suspected breach or unauthorized access.

5. INTELLECTUAL PROPERTY AND RESTRICTIONS

5.1 We retain all rights in the Platform. The Institution retains rights in its own content and data. The Institution grants us a license to host, store, and process Institution content and data solely to provide the Platform. The Institution receives a limited, non-exclusive, non-transferable right to use the Platform during the subscription term.

5.2 The Institution must not: reverse engineer the Platform; remove any proprietary notices; sublicense or resell the Platform; use it to build a competing product; or exceed authorized usage (e.g., user counts, storage, API limits).

6. TERM, SUSPENSION, AND TERMINATION

6.1 The term is as set forth in the Order Form. Either party may terminate for material breach that remains uncured after 30 days' written notice, or as otherwise permitted in the agreement.

6.2 We may suspend access immediately for: (a) non-payment; (b) violation of these Terms or law; (c) security or integrity concerns; or (d) to comply with law. We will use reasonable efforts to give advance notice where practicable. Suspension may apply to the entire Hybrid deployment or to specific modules as we deem appropriate.

6.3 Upon termination, the Institution's right to use the Platform ceases. Data export and retention are as set forth in our data retention policy and applicable law.

7. DISCLAIMER AND LIMITATION OF LIABILITY

7.1 THE PLATFORM IS PROVIDED "AS IS". WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION.

7.2 TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR AGGREGATE LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE FEES PAID BY THE INSTITUTION IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. WE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.

8. INDEMNIFICATION

The Institution shall indemnify and hold us harmless from claims, damages, and costs (including reasonable attorneys' fees) arising from: (a) the Institution's use of the Platform; (b) Institution Data or content; or (c) the Institution's breach of these Terms, except to the extent caused by our gross negligence or willful misconduct.

9. GENERAL

9.1 These Terms, together with the Order Form, Data Processing Agreement, and Privacy Policy, constitute the entire agreement. Amendments must be in writing. Our failure to enforce any right does not waive that right.

9.2 Governing law and jurisdiction are as set forth in the commercial agreement. If any provision is held invalid, the remainder remains in effect.

9.3 The Institution must accept these Terms before gaining access to the Platform. Continued use constitutes ongoing acceptance.
`;
