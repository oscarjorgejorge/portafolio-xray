# API V1 Prompts

## Cursor AI Conversation

### Prompt 1
as senior software engineer, data base specialist and senior arquitect, give me a plan step by step to implement the api that will support the mvp that we are building. You can inspect the docs on the docs folder. Give a plan, and focus only on the V1

### Prompt 2
this is the result from the morningstart resolution, I think we eneed to adapt the model
```json
{
  "url": "https://global.morningstar.com/es/inversiones/fondos/0P00018NVI/cotizacion",
  "title": "e.l.f. Beauty Inc",
  "snippet": "ID Principal: 0P00018NVI | ID Secundario: 0P00018NVI",
  "morningstarId": "0P00018NVI",
  "domain": "global.morningstar.com",
  "score": 30,
  "scoreBreakdown": {
    "isinMatch": 0,
    "nameMatch": 0,
    "morningstarDomain": 20,
    "typeMatch": 10
  }
}
```

### Prompt 3
creo que de momento para el model Asset solo necesitamos el Id, isin, morningstartID, name, type, url, source, createdAd, updatedAt

### Prompt 4
creo que hay que agregar el ticker

### Prompt 5
update the prompts file and execute the first 3 phases of the plan

### Prompt 6
I want to include Swagger, update the docs if it is need it. Also please read the folder poc, that it is a prove of concept that I build to check the best way to resolve the inputs to MorningstarIds (update the plan if need it)

### Prompt 7
continue with the the plan, and integrated swagger and consider the POC when it will be need it

### Prompt 8
where we are on the implementation? I think on the integration of the POC?

### Prompt 9
remember to update the prompts file with all the prompts, and we need also to run the migration and try swagger

### Prompt 10
(Prisma 7.x compatibility issue was found and fixed)

### Prompt 11
(assetType field was added to ResolveAssetDto)

### Prompt 12
(TECHNICAL-SPEC.md was updated)

### Prompt 13
where we are with our plan of the implementation?

### Prompt 14
trying this post api/assets/resolve with this data {"input": "LU1897414303", "assetType": "FUND"} I am getting this {"success": false, "source": "manual_required", "error": "Asset with identifier \"LU1897414303\" not found in cache. Manual input required."}, but in my poc I am getting an answer, is the poc logic implemented?

### Prompt 15
Only write my prompts, not your answers
