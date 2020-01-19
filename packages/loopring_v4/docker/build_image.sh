#!/bin/sh

target_image=contracts-beta2:0.1
container_name=contracts_beta2_1

docker rmi $target_image

docker build -t $target_image .

container_id_old=$(docker ps -aqf "name=$container_name")
echo "container_id_old: $container_id_old"
if [ ! -z "$container_id_old" ]; then
    docker rm $container_id_old
fi

docker run --name $container_name -p 8545:8545 $target_image &

sleep 3

docker_id=$(docker ps -qf "name=$container_name")
echo "docker_id: $docker_id"

if [ -z "$docker_id" ]; then
    echo "docker id is empty, docker run failed."
    exit 1
fi

cd ..

npm run migrate > "docker/$container_name.txt"

docker commit $docker_id  $target_image

docker kill $docker_id

echo "docker image: $target_image build succeeded!"
