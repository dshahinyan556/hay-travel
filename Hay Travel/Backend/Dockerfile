FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY *.slnx ./
COPY ATTours.ClientAPI/*.csproj ATTours.ClientAPI/
COPY ATTours.Common/*.csproj ATTours.Common/
COPY ATTours.ContextRepository/*.csproj ATTours.ContextRepository/
COPY ATTours.DataLayer/*.csproj ATTours.DataLayer/
COPY ATTours.Helper/*.csproj ATTours.Helper/
COPY ATTours.Service/*.csproj ATTours.Service/
RUN dotnet restore ATTours.ClientAPI/ATTours.ClientAPI.csproj

COPY . .
RUN dotnet publish ATTours.ClientAPI/ATTours.ClientAPI.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# tzdata обязателен: без базы таймзон TimeZoneInfo.FindSystemTimeZoneById("Asia/Yerevan")
# бросает исключение, и всё, что считает границу календарного дня по армянскому времени
# (автозакрытие дат брони, ArmeniaTimeZone), уходило бы на аварийный фолбэк. Образ
# aspnet:10.0 его не содержит — .NET-контейнеры по умолчанию живут в UTC.
# Глобализация НЕ инвариантная (InvariantGlobalization нигде не выставлен) — с ней
# таймзоны не работают вовсе.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ATTours.ClientAPI.dll"]
