  Email Processing Pipeline:

add lines for counting the number of folders, emails in total, emails per folder


  Phase 1: Email Collection & Filtering
  1. ProtonMail Bridge fetches all emails
  2. Filter for relevant emails
  3. Remove emails where rose@mobicycle.ee is sender
  4. Update todo list with new emails
  5. Send notifications to Claude & Rose

  Phase 2: Email Triage
  6. Shortlist one email for processing
  7-10. Extract context by finding:
  - Keywords
  - Email addresses
  - References (case numbers, etc.)
  11. Send shortlisted email + context to triage MCP server/worker

  Phase 3: Classification & Action
  12. Triage classifies as: (1) No action (2) Low complexity (3) High complexity
  13. No action → mark todo as closed
  14. Low complexity → Claude responds → mark closed
  15. High complexity → Claude creates documents/submits applications

  Phase 4: Document Generation & Delivery
  16-17. Claude writes attachments (letters, PDFs)
  18. Claude writes email cover letters
  19. Send attachments + cover letters to relevant parties
  20. Upload attachments to ce-file system
  21. Document everything in ce-file with explanations