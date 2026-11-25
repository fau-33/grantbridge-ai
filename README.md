# 🌱 GrantBridge AI

> **Conectando projetos locais de impacto ambiental aos bilhões de dólares em fundos climáticos globais.**

Projeto desenvolvido para o **Hack Brasil 2026** na trilha **Meio ambiente & economia verde**.

---

## 🎯 O Problema

Existem bilhões de dólares disponíveis em fundos climáticos e editais internacionais (ONU, fundações ambientais, bancos de desenvolvimento) destinados à preservação, reflorestamento e economia verde. No entanto, pequenas ONGs, cooperativas e projetos locais no Brasil não acessam esses recursos por três barreiras:

1. Editais fragmentados em centenas de portais internacionais.
2. Barreira linguística e termos técnicos complexos.
3. Falta de verba para contratar consultores especializados na redação de propostas.

## 💡 A Solução

O **GrantBridge AI** utiliza agentes de raspagem web e IA generativa para:

1. **Monitorar e extrair** editais internacionais abertos em tempo real (**Firecrawl**).
2. **Indexar e cruzar** oportunidades com o perfil da iniciativa local (**Neon PostgreSQL**).
3. **Calcular compatibilidade (Match Score)** e **gerar a proposta técnica completa em inglês** pronta para submissão.

## 🏗️ Arquitetura

- **Frontend (`/frontend`):** Next.js + Tailwind CSS (Interface de consulta, radar de editais e gerador de propostas).
- **Backend (`/backend`):** Python / FastAPI (Orquestração de IA e integração com Firecrawl).
- **Banco de Dados:** Neon (Serverless PostgreSQL) para armazenamento de editais indexados e histórico de propostas.
- **Engenharia & Automação:** Desenvolvido com apoio do **Devin Pro** e **Firecrawl API**.
