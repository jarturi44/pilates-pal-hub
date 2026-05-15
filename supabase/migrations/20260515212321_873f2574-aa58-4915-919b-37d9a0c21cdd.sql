
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

create policy "Branding assets are publicly readable"
on storage.objects for select
using (bucket_id = 'branding');
