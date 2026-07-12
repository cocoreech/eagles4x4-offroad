-- 0029 — Update post_service email template with mechanic personalization.
-- Taglish tone, mechanic signature, branch, and feedback link (feedback_url
-- token added to the touchpoints engine in the companion code change).

update public.touchpoint_templates
set body = 'Hi {{customer_name}}, si {{mechanic_name}} ''to from Eagles 4x4 {{branch_name}}. Hope the {{service}} on your {{vehicle}} is treating you right after kahapon. Kumusta na, good ba lahat?

Leave feedback: {{feedback_url}}'
where type = 'post_service' and channel = 'email';
