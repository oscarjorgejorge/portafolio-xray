# Documentation Prompts

## Cursor AI Conversation

### Prompt 1
I need that you save all the promps of this conversation on the folder prompts and create a new md file "documentation"

### Prompt 2
as product expert, I need to refine the project that I want to create, and define the scope of the project. The starting point will be the @docs/idea-investigation.md. Before generating new documents I want to discuss the possible goals, use cases, functionalities and scope of the project. Lets start with the goals

### Prompt 3
thank you to ask me the questions, keep doing that when it is need it. Remember to save the prompts on the @prompts/documentation.md. The answers: 1. generate x-ray reports it is complicated and tedious process on excells that it does not always work. 2. the primary user is indiviudal retail investors. 3. Number of X-Rays generated.

### Prompt 4
mvp scope: Generate + Download + Shareable URL, the excel pain is a bit of all the options that you mention

### Prompt 5
yes lets move to the use cases, for your questions, currently the users manually type each position. They fill the data in the excell to generate this reports. They find the ISIN of the ETF, FUNDS or Stocks, they go to morningstar website, they find usually on the url the Morningstar ticker and they use this code on the excell per each asset of their portafolio. V1 should support ETFs, Funds and individual stocks

### Prompt 6
for question 8 and question 9, both should work. for question 10, ideally it would be the best that user can input name of the asset, ISIN, or Morningstar code and the system should be smart enough to resolve it properly. But it should be some kind of validation to confirm that the resolve morningstar resolution is correct

### Prompt 7
11 After each asset is added (one by one), 12 Show all 5 and let user pick, 13 Unlimited (but if user choose the set allocation as percentage the total should be 100%

### Prompt 8
I am not sure if the asset input should accept name too, too much flexibility could lead a bad experience? sp 500... there are many many funds, what do you think?

### Prompt 9
make sense, this search by name should be outside of the form of the portafolio. one general input as an extra, but just optionally

### Prompt 10
I have change my opinion, I think the asset finder for now will not be necesary, users that will create their portafolio report should have a basic knowledge of what their portafolio will be made of, so not need for the asset finder (there are many websites specialice on funds, etfs, where you can search the assets)

### Prompt 11
@assets el objetivo de momento es simplemente generar urls que apunten a Morningstar ya que ellos generan los pdfs, como en la imagen adjunta

### Prompt 12
16) A y B. 17), I think it will be better B, 18) for V1 only generate de URL

### Prompt 13
A) Query params in URL (simpler, visible: ?assets=ISIN:40,ISIN:30)

I think this will be the best option, but I still would like to have the data base to start to store the resolved assets on the db as described on this flow: NORMALIZACIÓN DE INPUT (obligatorio) → BÚSQUEDA EN BASE DE DATOS → RESOLUCIÓN AUTOMÁTICA (SOLO SI NO EXISTE) → VALIDACIÓN DE COHERENCIA → ESTADOS DE RESOLUCIÓN → PERSISTENCIA (APRENDIZAJE DEL SISTEMA)

### Prompt 14
what is your opion on 20 and 21?

### Prompt 15
yes (agreed with recommendations: Q20=C show alternatives, Q21=A allow manual input)

### Prompt 16
yes, start with the PRD, generate it on folder name it V1 inside docs, md format, be concise, not need to generate too large documentation

### Prompt 17
before this, how I could track the number of generated urls? also I thikn this part should be validated during the implementation: confidence scoring with resolution states (resolved_auto, low_confidence, needs_review)

### Prompt 18
Mark as "to be defined during implementation", and for tracking I think It will be a decision for later, maybe we cover the scope of V1 fast and we can implement authentication system and have already the tracking for logged users and we need to find a solution for unauthenticated users

### Prompt 19
generate the use cases on new md on the V1 folder

### Prompt 20
we will focus later on this, I would like to prepare docs for the V2 stage and having the whole scope, even if it is phase by phase, prepare some diagrams and architecture, technical spec to have the whole picture

### Prompt 21
I dont need github as OAuth providers

### Prompt 22
what it will be this? @PRD.md (31-32) - List of user's portfolios

### Prompt 23
what this means? @PRD.md (42-43) - Portfolio History

### Prompt 24
C) Keep it simple — just "last updated timestamp" without full version history

### Prompt 25
add userName on User interface and remove github as provider

### Prompt 26
necesitaria 3 entidades para los assets y xrays? Asset (instrumento), XRay (análisis/documento), XRayAsset (relación cartera) - with detailed fields for each

### Prompt 27
xray should have updatedAt, just keep in mind that there is 3 entities, after ownerId should always exists, the properties of this 3 entities there are not important, but there should be 3 I think

### Prompt 28
how it will be portafolio comparision

### Prompt 29
I think there is not need for this uc now: User Following and Trending Section (remove from V3)

### Prompt 30
remove for now also this: Follow portfolio owner, Receive updates on followed users

### Prompt 31
remove also this: Follow relationships (from Success Metrics)

### Prompt 32
do we need on V1 this model if we are not going to store the XRAY? (XRay model in TECHNICAL-SPEC.md)

### Prompt 33
A) Move XRay/XRayAsset to a "V2 Entities" section (clearer separation)

### Prompt 34
for now all the XRaySource will be morningstar, I dont think we need this enum

### Prompt 35
I am not sure about this entities, AssetSource and AssetStatus enums - how it will work on the flow, what do you think?

### Prompt 36
keep for now (AssetSource and AssetStatus enums)

### Prompt 37
the architecture proposed is based on DDD?

### Prompt 38
explain me how this it will be? B) Add light DDD concepts (use cases layer, better separation)

### Prompt 39
C) Stay with simple architecture (faster to build)

### Prompt 40
and who is connecting to the database? assets.service.ts

### Prompt 41
would it be convenient to have and aditional file to handle the interaction with the prismaService? for example AssetRepository?

### Prompt 42
yes (add repository pattern to TECHNICAL-SPEC.md)

### Prompt 43
can you generate a mermaid diagram of the users interaction (adding the stage implementation)

### Prompt 44
can you generate a separate file for this? I was thinking on a diagram of this style (sequence diagram photo attached)

### Prompt 45
how I can preview the mermaid squemas of @ARCHITECTURE.md

### Prompt 46
now I think we can generate the user stories for V1 use cases

### Prompt 47
US-04: i think when system can not resolve the ISIN, the user needs to find it manually (simplify - no alternatives from system)

### Prompt 48
US-12 (Paste Multiple Assets / Bulk Input) will not be necessary for now - remove

### Prompt 49
US-12 (View Resolution Cache Hit) also not needed for now - remove

### Prompt 50
generate a readme file Con la ficha del proyecto, descripción general del producto, arquitectura, modelo de datos, API, historias de usuario, tickets de trabajo y pull requests

### Prompt 51
I need the doc in english
