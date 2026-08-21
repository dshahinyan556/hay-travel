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
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ATTours.ClientAPI.dll"]
