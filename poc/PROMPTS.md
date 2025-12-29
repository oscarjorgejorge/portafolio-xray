# Prompts de la Sesión - ISIN to Morningstar Resolver POC

## Sesión de Desarrollo y Testing

### 1. Solicitud Inicial
```
necesito generar una prueba de concepto rapida para testear esta solucion: 🧠 3️⃣ LÓGICA DE RESOLUCIÓN ISIN → MORNINGSTAR (CORE) ... 👉 Esto decide qué pipeline usar. ... 👉 Si existe → FIN DEL PROCESO. ... 👉 El mayor score gana. (necesito testeaar solo el punto 3), y simplemente quiero testearlo poniendo codigos manualmente y correr algun script, antes de implementar nada, tienes alguna pregunta?
```

### 2. Configuración del Proyecto
```
Node.js/TypeScript, ¿Quieres que los resultados se guarden en un JSON, se muestren en consola, o ambos? ambos, ejemplos: IE00BBL4VX78. LU1897414303, estas son las urls de uno de los fondos : https://global.morningstar.com/es/inversiones/fondos/F00000THA5/cotizacion
```

### 3. Problemas de Instalación
```
porque tarda tanto?
```

### 4. Tests de ISINs
```
puedes ahora buscar este fondo LU1241525184
```

```
yo encontre esta url: https://global.morningstar.com/es/inversiones/fondos/0P000168Z7/cotizacion
```

```
probemos con este LU2132883187
```

```
probemos con este: LU1820812136
```

### 5. Tests de Tickers
```
prueba con este: ELF
```

```
la accion, imaginemos que solo podemos usar tickers, ISIN, o codigos Morningstar, nunca nombres
```

```
probemos con este: CELH
```

```
verifiquemos con este: NIKE
```

```
podemos probar con este: AMD
```

### 6. Tests de ISINs Adicionales
```
y este IE00BG0SKF03 ?
```

### 7. Revisión del Código
```
hay algo en el codigo que haya que mejorar o corregir?
```

### 8. Explicación del Sistema
```
Me puedes explicar paso a paso como funciona el codigo?
```

```
de las pruebas optenidas, que status se les ha dado a los resultados?
```

### 9. Tests de Morningstar IDs
```
que haria el sistema si el input es directamente el id de Morningstar?
```

```
no hace falta optimizar esto, ya que en lo que quiero implementar esta prueba de concepto, me gustaria que si me dan un codigo morningstart, 0P0001DZSM, buscarlo en la web, para obtener el nombre, guardarlo en la base de datos y luego mostrarlo al usuario, pero no quiero implementarlo ahora. Entonces si paso un codigo morningstart, la logica sigue funcionando? 0P0001DZSM
```

### 10. Documentación
```
quiero que me generes un md explicando como funciona la prueba de concepto
```

### 11. Generación de X-Ray URLs
```
puedes hacerme una composicion aleatoria con todos los codigos de morningstart proporcionados y diferentes pesos para construir una urls como esta? (photo adjunta)
```

```
esta url no funciona: https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&PortfolioType=2&SecurityTokenList=... pero esta si: https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&PortfolioType=2&SecurityTokenList=...&values=20000%7C15850%7C27500%7C14250%7C11500%7C15750
```

```
puedes anadir este codigo con algun peso y volver a generarlo? 0P0000A5TF
```

### 12. Tipos de Activos
```
para encontrar los codigos de morningstarid necesitamos saber que tipo de asset es?
```

### 13. Corrección de URLs
```
estas urls no estan funcionando https://global.morningstar.com/es/inversiones/fondos/0P0001DZSM/cotizacion
```

```
estas urls si que funcionan https://global.morningstar.com/es/inversiones/acciones/0P00018NVI/cotizacion?bolsa=XNYS&ticker=ELF https://global.morningstar.com/es/inversiones/fondos/0P000134LI/cotizacion https://global.morningstar.com/es/inversiones/fondos/0P0001EXVW/cotizacion https://global.morningstar.com/es/inversiones/acciones/0P0000COVI/cotizacion?bolsa=XNAS&ticker=CELH https://global.morningstar.com/es/inversiones/acciones/0P000003X1/cotizacion?bolsa=XNYS&ticker=NKE estas son las urls de los activos que he encontrado manualmente, son las mismas que me has proporcionado antes?
```

```
estas 3 ultimas urls no abren correctamente, las 2 primeras si
```

### 14. Consultas Específicas
```
dame la url de nike
```

```
y la url de AMP?
```

```
y de est morningstarId 0P0000A5TF?
```

```
no puedes distinguir si es una accion o fondo?
```

### 15. Correcciones de Datos
```
si (confirmar corrección de Amper SA como Acción)
```

```
si (regenerar URL de X-Ray)
```

### 16. Generación Manual de X-Ray
```
genera un xray a partir de estos datos: 0P000003RE	20,00%
0P000002HD	15,85%
0P000000B7	27,50%
F0GBR04UOL	14,25%
0P000000H9	11,50%
0P0000L2QW	15,75%
```

### 17. Documentación Final
```
create a md file with all the prompts
```

---

## Resumen de Funcionalidades Probadas

1. **Resolución de ISINs** → Morningstar IDs
2. **Resolución de Tickers** → Morningstar IDs
3. **Búsqueda de Morningstar IDs** → Nombres y URLs
4. **Detección automática de tipo** (Fondo vs Acción)
5. **Generación de URLs de Morningstar**
6. **Generación de URLs de X-Ray** para análisis de carteras

## ISINs/Tickers/IDs Probados

| Input | Tipo | Morningstar ID | Nombre |
|-------|------|----------------|--------|
| IE00BBL4VX78 | ISIN | 0P000134LI | Federated Hermes Asia ex-Japan |
| LU1897414303 | ISIN | - | - |
| LU1241525184 | ISIN | 0P000168Z7 | BlackRock Strategic Funds |
| LU2132883187 | ISIN | 0P0001JIA2 | DB Growth SAA |
| LU1820812136 | ISIN | 0P0001EHST | Capital Group Capital Income Builder |
| IE00BG0SKF03 | ISIN | 0P0001F9QM | iShares MSCI EM Value Factor ETF |
| ELF | Ticker | 0P00018NVI | e.l.f. Beauty |
| CELH | Ticker | 0P0000COVI | Celsius Holdings |
| NIKE/NKE | Ticker | 0P000003X1 | Nike Inc |
| AMD | Ticker | 0P0000006A | Advanced Micro Devices |
| 0P0001DZSM | MS ID | 0P0001DZSM | BNP Paribas Easy MSCI Emerging SRI |
| 0P0000A5TF | MS ID | 0P0000A5TF | Amper SA |

