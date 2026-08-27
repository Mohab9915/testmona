# Deploying TestMona on a GCP free-tier VM

Sized for an **e2-micro** in `us-west1` / `us-central1` / `us-east1` with a
**standard** persistent disk — the combination Google's Always Free tier
covers. Anything else on that page bills: a *balanced* disk, a *reserved*
static IP, snapshot schedules, or the Ops Agent.

The app needs about **210 MB** of the 1 GB. The tight resource is not memory
but **egress**: the free tier allows 1 GB/month out of North America.

## First boot

SSH into the VM, then:

```bash
curl -fsSL https://raw.githubusercontent.com/Mohab9915/testmona/main/deploy/gcp-setup.sh | bash
```

It creates swap, installs Docker, clones the repo, writes a `.env` with a
generated `SECRET_KEY`, builds, starts, and installs a nightly backup cron.
Safe to re-run — every step checks its own state.

Expect **10–20 minutes**. The frontend build is the slow part: `vite build` on a
shared core with 1 GB of RAM is why the script creates 4 GB of swap before
touching Docker.

## Open the firewall

GCP blocks inbound ports by default. Run this **from your workstation or Cloud
Shell**, not on the VM:

```bash
gcloud compute firewall-rules create testmona-web \
  --allow=tcp:3000 --target-tags=testmona --source-ranges=0.0.0.0/0
```

```bash
gcloud compute instances add-tags <INSTANCE> --zone=<ZONE> --tags=testmona
```

Then open `http://<EXTERNAL_IP>:3000`. The first visit routes to `/setup` to
create the administrator account.

## Adding HTTPS

Plain HTTP is fine while you are the only user, but the login form posts a
password. For anything shared, put Caddy in front — it obtains and renews a
Let's Encrypt certificate on its own.

You need a **domain pointing at the VM's IP** first. Let's Encrypt will not
issue for a bare IP address, and the free tier's IP is ephemeral, so a free
dynamic-DNS hostname is the usual answer.

Create `deploy/Caddyfile`:

```
your-domain.example.com {
    reverse_proxy localhost:3000
}
```

Then:

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
```

```bash
sudo caddy run --config deploy/Caddyfile
```

Afterwards, update `ALLOWED_ORIGINS` in `.env` to the `https://` origin and
restart, or the browser will block API calls as cross-origin.

Once Caddy is fronting the app, close port 3000 and open 80/443 instead.

## Updating

```bash
cd ~/testmona && git pull && sudo docker compose up -d --build
```

`.env` and the `backend_data` volume are untouched by a rebuild, so
configuration and the database survive.

Rebuilding on the VM costs 10–20 minutes each time. If that becomes tiresome,
build in CI and pull instead: `.github/workflows/docker-build.yml` already runs
buildx — adding `push: true` and a `ghcr.io` login turns it into a deployment
pipeline, and the VM then only pulls.

## Backups

The script installs a nightly job at 03:00 writing to `/var/backups/testmona`,
keeping 14 days. It uses SQLite's `.backup` API rather than copying the file, so
the snapshot is consistent even mid-write.

That is a *local* backup — it dies with the VM. For off-box durability, push it
to Cloud Storage, whose free tier includes 5 GB:

```bash
gsutil cp /var/backups/testmona/$(ls -t /var/backups/testmona | head -1) gs://<your-bucket>/
```

The database is roughly 2 MB, so this is well inside the free allowance.

## Watching the cost

Set a **budget alert at $1** (Billing → Budgets & alerts). The free tier is
applied as a credit at billing time, so the estimator showing ~$6/month for
compute is expected — check Billing → Reports after 48 hours and confirm the
charge has a matching credit line.

Two things bill quietly if you are not careful:

- **Egress beyond 1 GB/month** (~$0.12/GB). The `nginx` config caches hashed
  assets for a year, so repeat visits cost almost nothing — but public report
  links shared widely will show up here.
- **A second e2-micro.** The allowance is an hours budget (~730/month) pooled
  across instances and regions, so one always-on VM consumes all of it.

## Resource notes

Measured on this app, not estimated:

| | |
|---|---|
| backend | ~186 MB |
| frontend (nginx) | ~22 MB |
| images on disk | ~506 MB |
| database | ~2 MB |

The `.env` caps the backend at 640 MB and the frontend at 128 MB rather than
splitting the box evenly — nginx serving static files needs very little, and the
headroom is better spent on Python.
