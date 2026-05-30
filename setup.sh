#!/usr/bin/env bash
set -euo pipefail

# ---- Couleurs ----
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RST='\033[0m'

# ---- Spinner ----

SPINNER_FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

run_with_spinner() {
  local label="$1"; shift
  local tmplog; tmplog=$(mktemp)

  echo -ne "  ${DIM}${SPINNER_FRAMES[0]}${RST} ${label}..."

  "$@" </dev/null >"$tmplog" 2>&1 &
  local pid=$!
  local i=0

  while kill -0 "$pid" 2>/dev/null; do
    echo -ne "\r  ${DIM}${SPINNER_FRAMES[$((i % ${#SPINNER_FRAMES[@]}))]}${RST} ${label}..."
    i=$((i + 1))
    sleep 0.08
  done

  wait "$pid"
  local code=$?

  if [ "$code" -eq 0 ]; then
    echo -e "\r  ${GREEN}✓${RST} ${label}          "
  else
    echo -e "\r  ${RED}✗${RST} ${label}"
    echo -e "${RED}"
    cat "$tmplog"
    echo -e "${RST}"
    rm -f "$tmplog"
    exit "$code"
  fi

  rm -f "$tmplog"
}

# ---- Utilitaires ----

print_header() { echo -e "\n${BOLD}${BLUE}$1${RST}\n"; }
print_done()   { echo -e "${GREEN}✓ $1${RST}"; }
print_info()   { echo -e "${CYAN}  $1${RST}"; }

select_option() {
  local prompt="$1"; shift
  local options=("$@")
  local selected=0
  local key key2

  echo -e "${BOLD}$prompt${RST}"
  tput civis

  while true; do
    for i in "${!options[@]}"; do
      if [ "$i" -eq "$selected" ]; then
        echo -e "  ${GREEN}${BOLD}> ${options[$i]}${RST}"
      else
        echo -e "  ${DIM}  ${options[$i]}${RST}"
      fi
    done

    tput cuu "${#options[@]}"

    IFS= read -r -s -n1 key </dev/tty 2>/dev/null || true
    if [[ "$key" == $'\x1b' ]]; then
      IFS= read -r -s -n2 key2 </dev/tty 2>/dev/null || true
      case "$key2" in
        '[A') [ "$selected" -gt 0 ] && selected=$((selected - 1)) ;;
        '[B') [ "$selected" -lt $((${#options[@]} - 1)) ] && selected=$((selected + 1)) ;;
      esac
    elif [[ "$key" == $'\n' || "$key" == '' ]]; then
      break
    fi
  done

  tput cud "${#options[@]}"
  tput cnorm
  echo -e "  ${GREEN}✓ ${options[$selected]}${RST}\n"

  SELECTED_INDEX=$selected
  SELECTED_VALUE="${options[$selected]}"
}

ask_input() {
  local prompt="$1"
  local default="${2:-}"
  local secret="${3:-false}"

  if [ -n "$default" ]; then
    echo -ne "${BOLD}$prompt${RST} ${DIM}[$default]${RST} : "
  else
    echo -ne "${BOLD}$prompt${RST} : "
  fi

  if [ "$secret" = "true" ]; then
    read -rs INPUT_VALUE </dev/tty; echo
  else
    read -r INPUT_VALUE </dev/tty
  fi

  if [ -z "$INPUT_VALUE" ]; then INPUT_VALUE="$default"; fi
}

ask_yesno() {
  local prompt="$1"
  local default="${2:-y}"
  local hint; [ "$default" = "y" ] && hint="O/n" || hint="o/N"
  echo -ne "${BOLD}$prompt${RST} ${DIM}[$hint]${RST} : "
  read -r YN_VALUE </dev/tty
  YN_VALUE="${YN_VALUE:-$default}"
  [[ "$YN_VALUE" =~ ^[OoYy]$ ]]
}

# ---- Entete ----

clear
echo -e "${BOLD}${BLUE}"
echo "   ╔══════════════════════════════════╗"
echo "   ║         Scrip  -  Setup          ║"
echo "   ╚══════════════════════════════════╝"
echo -e "${RST}${DIM}   Configuration interactive de votre instance"
echo -e "   by https://gabizoc.fr${RST}\n"

# ---- Verifications ----

if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js introuvable. Installez Node.js 20+ avant de continuer.${RST}"
  exit 1
fi

NODE_VER=$(node -v | tr -d 'v' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo -e "${RED}✗ Node.js 20+ requis (version actuelle : $(node -v))${RST}"
  exit 1
fi
print_done "Node.js $(node -v) detecte"

# ---- Installation ----

print_header "1 - Installation des dependances"

run_with_spinner "Racine"         npm install
run_with_spinner "Backend"        bash -c "cd backend && npm install"
run_with_spinner "Frontend"       bash -c "cd frontend && npm install"
run_with_spinner "Build frontend" bash -c "cd frontend && npm run build"

# ---- Serveur ----

print_header "2 - Serveur"

ask_input "Port du serveur" "7001"
CFG_PORT="$INPUT_VALUE"

ask_input "URL publique (ex: https://scrip.mondomaine.com)" ""
CFG_PUBLIC_URL="$INPUT_VALUE"

if ask_yesno "Generer un SESSION_SECRET automatiquement ?" "y"; then
  CFG_SESSION=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  print_info "SESSION_SECRET genere"
else
  ask_input "SESSION_SECRET (32+ caracteres)" "" "true"
  CFG_SESSION="$INPUT_VALUE"
fi

# ---- Authentification ----

print_header "3 - Authentification"

select_option "Mode :" \
  "Mot de passe simple  (recommande - aucun serveur mail requis)" \
  "Magic link par email (necessite un serveur SMTP)"

AUTH_MODE=$SELECTED_INDEX
CFG_AUTH_PASSWORD=""
CFG_AUTH_EMAIL=""
CFG_SMTP_HOST=""; CFG_SMTP_PORT=""; CFG_SMTP_SECURE=""
CFG_SMTP_USER=""; CFG_SMTP_PASS=""; CFG_SMTP_FROM=""

if [ "$AUTH_MODE" -eq 0 ]; then
  ask_input "Mot de passe" "" "true"
  CFG_AUTH_PASSWORD="$INPUT_VALUE"
else
  ask_input "Email autorise a se connecter" ""
  CFG_AUTH_EMAIL="$INPUT_VALUE"

  select_option "Fournisseur SMTP :" \
    "Gmail              (smtp.gmail.com:587)" \
    "Brevo / Sendinblue (smtp-relay.brevo.com:587)" \
    "OVH                (ssl0.ovh.net:587)" \
    "Autre              (saisie manuelle)"

  case "$SELECTED_INDEX" in
    0) CFG_SMTP_HOST="smtp.gmail.com";       CFG_SMTP_PORT="587"; CFG_SMTP_SECURE="false" ;;
    1) CFG_SMTP_HOST="smtp-relay.brevo.com"; CFG_SMTP_PORT="587"; CFG_SMTP_SECURE="false" ;;
    2) CFG_SMTP_HOST="ssl0.ovh.net";         CFG_SMTP_PORT="587"; CFG_SMTP_SECURE="false" ;;
    3)
      ask_input "SMTP_HOST" "";           CFG_SMTP_HOST="$INPUT_VALUE"
      ask_input "SMTP_PORT" "587";        CFG_SMTP_PORT="$INPUT_VALUE"
      ask_input "SMTP_SECURE (true/false)" "false"; CFG_SMTP_SECURE="$INPUT_VALUE"
      ;;
  esac

  ask_input "SMTP_USER (identifiant de connexion)" ""
  CFG_SMTP_USER="$INPUT_VALUE"
  ask_input "SMTP_PASS" "" "true"
  CFG_SMTP_PASS="$INPUT_VALUE"
  ask_input "SMTP_FROM" "Scrip <$CFG_SMTP_USER>"
  CFG_SMTP_FROM="$INPUT_VALUE"
fi

# ---- Pipeline IA ----

print_header "4 - Pipeline IA"

select_option "Mode pipeline :" \
  "auto    - essaie dans l'ordre : ollama > google > nvidia > mistral (recommande)" \
  "ollama  - Ollama cloud/local (gratuit)" \
  "google  - Google Gemini (cle API requise)" \
  "nvidia  - NVIDIA NIM (cle API requise)" \
  "mistral - Mistral OCR + LLM (cle API requise)"

PIPELINE_MODES=("auto" "ollama" "google" "nvidia" "mistral")
CFG_PIPELINE="${PIPELINE_MODES[$SELECTED_INDEX]}"

CFG_OLLAMA_URL=""; CFG_OLLAMA_MODEL=""
CFG_GOOGLE_KEY=""; CFG_NVIDIA_KEY=""; CFG_MISTRAL_KEY=""

if [ "$CFG_PIPELINE" = "auto" ] || [ "$CFG_PIPELINE" = "ollama" ]; then
  echo
  if ask_yesno "Configurer Ollama ?" "y"; then
    ask_input "URL Ollama" "http://localhost:11434"
    CFG_OLLAMA_URL="$INPUT_VALUE"

    select_option "Modele Ollama :" \
      "gemma4:31b-cloud    (recommande - excellent francais)" \
      "qwen3-vl:32b-cloud  (ideal tableaux et schemas)" \
      "qwen3.5:cloud       (tres bonne comprehension)" \
      "Autre               (saisie manuelle)"

    case "$SELECTED_INDEX" in
      0) CFG_OLLAMA_MODEL="gemma4:31b-cloud" ;;
      1) CFG_OLLAMA_MODEL="qwen3-vl:32b-cloud" ;;
      2) CFG_OLLAMA_MODEL="qwen3.5:cloud" ;;
      3) ask_input "Nom du modele" ""; CFG_OLLAMA_MODEL="$INPUT_VALUE" ;;
    esac
  fi
fi

if [ "$CFG_PIPELINE" = "auto" ] || [ "$CFG_PIPELINE" = "google" ]; then
  DFLT="n"; [ "$CFG_PIPELINE" = "google" ] && DFLT="y"
  echo
  if ask_yesno "Configurer Google Gemini ?" "$DFLT"; then
    ask_input "GOOGLE_API_KEY" "" "true"
    CFG_GOOGLE_KEY="$INPUT_VALUE"
  fi
fi

if [ "$CFG_PIPELINE" = "auto" ] || [ "$CFG_PIPELINE" = "nvidia" ]; then
  DFLT="n"; [ "$CFG_PIPELINE" = "nvidia" ] && DFLT="y"
  echo
  if ask_yesno "Configurer NVIDIA NIM ?" "$DFLT"; then
    ask_input "NVIDIA_API_KEY" "" "true"
    CFG_NVIDIA_KEY="$INPUT_VALUE"
  fi
fi

if [ "$CFG_PIPELINE" = "auto" ] || [ "$CFG_PIPELINE" = "mistral" ]; then
  DFLT="n"; [ "$CFG_PIPELINE" = "mistral" ] && DFLT="y"
  echo
  if ask_yesno "Configurer Mistral ?" "$DFLT"; then
    ask_input "MISTRAL_API_KEY" "" "true"
    CFG_MISTRAL_KEY="$INPUT_VALUE"
  fi
fi

echo
if ask_yesno "Activer le debug pipeline ?" "n"; then
  CFG_DEBUG="true"
else
  CFG_DEBUG="false"
fi

# ---- Ecriture du .env ----

print_header "5 - Ecriture du .env"

{
  echo "# Scrip - Configuration generee par setup.sh"
  echo "# by https://gabizoc.fr"
  echo ""
  echo "# ---- Cles API + Modeles ----"
  echo ""

  [ -n "$CFG_OLLAMA_URL" ] && {
    echo "OLLAMA_BASE_URL=$CFG_OLLAMA_URL"
    echo "OLLAMA_MODEL=$CFG_OLLAMA_MODEL"
    echo "OLLAMA_VALIDATION=true"
    echo ""
  }
  [ -n "$CFG_GOOGLE_KEY" ]  && { echo "GOOGLE_API_KEY=$CFG_GOOGLE_KEY";  echo ""; }
  [ -n "$CFG_MISTRAL_KEY" ] && { echo "MISTRAL_API_KEY=$CFG_MISTRAL_KEY"; echo ""; }
  [ -n "$CFG_NVIDIA_KEY" ]  && { echo "NVIDIA_API_KEY=$CFG_NVIDIA_KEY";  echo ""; }

  echo "# ---- Backend ----"
  echo ""
  echo "PORT=$CFG_PORT"
  echo "PIPELINE_MODE=$CFG_PIPELINE"
  echo "DEBUG_PIPELINE=$CFG_DEBUG"
  echo ""
  echo "# ---- Auth ----"
  echo ""
  echo "PUBLIC_URL=$CFG_PUBLIC_URL"
  echo "SESSION_SECRET=$CFG_SESSION"
  echo ""

  if [ "$AUTH_MODE" -eq 0 ]; then
    echo "AUTH_PASSWORD=$CFG_AUTH_PASSWORD"
  else
    echo "AUTH_EMAIL=$CFG_AUTH_EMAIL"
    echo ""
    echo "# ---- SMTP ----"
    echo ""
    echo "SMTP_HOST=$CFG_SMTP_HOST"
    echo "SMTP_PORT=$CFG_SMTP_PORT"
    echo "SMTP_SECURE=$CFG_SMTP_SECURE"
    echo "SMTP_USER=$CFG_SMTP_USER"
    echo "SMTP_PASS=$CFG_SMTP_PASS"
    echo "SMTP_FROM=$CFG_SMTP_FROM"
  fi
} > .env

print_done ".env cree"

# ---- Demarrage ----

print_header "6 - Demarrage"

if command -v pm2 &>/dev/null; then
  if ask_yesno "Demarrer Scrip avec PM2 maintenant ?" "y"; then
    run_with_spinner "Demarrage PM2" pm2 start ecosystem.config.cjs
    pm2 save --force >/dev/null 2>&1
    print_done "Scrip demarre avec PM2"
  fi
else
  print_info "PM2 non detecte. Pour demarrer :"
  print_info "  node backend/src/server.js"
fi

# ---- Resume ----

echo
echo -e "${BOLD}${GREEN}  Setup termine !${RST}"
echo
echo -e "  Auth     : ${CYAN}$([ "$AUTH_MODE" -eq 0 ] && echo "mot de passe" || echo "magic link ($CFG_AUTH_EMAIL)")${RST}"
echo -e "  Pipeline : ${CYAN}$CFG_PIPELINE${RST}"
[ -n "$CFG_OLLAMA_MODEL" ] && echo -e "  Modele   : ${CYAN}$CFG_OLLAMA_MODEL${RST}"
echo -e "  URL      : ${CYAN}${CFG_PUBLIC_URL:-http://localhost:$CFG_PORT}${RST}"
echo -e "\n${DIM}  by https://gabizoc.fr${RST}\n"
