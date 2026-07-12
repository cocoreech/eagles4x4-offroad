-- 0031 — Personalize appointment reminder and PMS reminder with warm, friend-like Taglish tone.

update public.touchpoint_templates
set subject = 'Hey {{customer_name}}, your booking is tomorrow!',
    body = 'Hey {{customer_name}}! Si {{mechanic_name}} is gonna take care of your {{vehicle}} tomorrow at {{time}} here at {{branch_name}}. Looking forward to it! If you need to move things around, just say the word, okay?'
where type = 'appointment_reminder' and channel = 'email';

update public.touchpoint_templates
set body = 'Hey {{customer_name}}! Just giving you a heads up, si {{mechanic_name}} will handle your {{service}} tomorrow at {{time}}. See you! Anything you need to change, let us know.'
where type = 'appointment_reminder' and channel = 'chat';

update public.touchpoint_templates
set subject = 'Your {{vehicle}} might be due for a check-up',
    body = 'Hey {{customer_name}}! Just a heads up, it''s been about 4 months since we serviced your {{vehicle}}. Might be good to get it checked soon kaya we''re here whenever you need us. No rush, just let us know!'
where type = 'pms_reminder' and channel = 'email';

update public.touchpoint_templates
set body = 'Hey {{customer_name}}! Just checking in, it''s been about 4 months since we last serviced your {{vehicle}}. Feel free to bring it in anytime if you want a check-up. We''re here!'
where type = 'pms_reminder' and channel = 'chat';
