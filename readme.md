cd /Users/leven/space/cms/stock/newstock/backend
cp .env.example .env # first time only; edit as needed
go build -o bin/aistock-server ./cmd/server



make backend-build


cd /Users/leven/space/cms/stock/newstock
pm2 start ecosystem.config.cjs