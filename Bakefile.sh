# shellcheck shell=bash

task.init() {
	pnpm install
}

# shellcheck disable=SC2034
task.generate-assets() {
	local decoration_color='#ffdeeb'
	local ecosystem_color='#e5dbff'
	local platform_color='#ffe8cc'

	for dir in ./pack-*/; do
		dir=${dir%/}
		bake.info "Generating for \"$dir\""
		local icon_name=${dir##*-}
		local type=${dir#./pack-}; type=${type%%-*}
		local color_var="${type}_color"
		local -n color="$color_var"

		if [[ $dir == ./pack-{ecosystem,platform}-!(all|other) ]]; then
			mkdir -p "$dir/assets"
			magick convert ./assets/package-512px.png -background "$color" -flatten -alpha off ./temp.png
			local resize=x225
			case $icon_name in
				php) resize=x175 ;;
				go) resize=x175 ;;
				java) resize=x325 ;;
				cpp) resize=x250 ;;
				latex) resize=x175 ;;
				markdown) resize=x200 ;;
				rust) resize=x250 ;;
				web) resize=x200 ;;
			esac
			magick ./temp.png \( "./assets/$icon_name.png" -resize "$resize" -geometry +8+8 \) -gravity southeast -composite "$dir/assets/icon.png"
			rm ./temp.png
		else
			magick convert ./assets/package-512px.png -background "$color" -flatten -alpha off "$dir/assets/icon.png"
		fi
	done
}

task.publish() {
	local pack_dir=$1
	pack_dir=${pack_dir%/}

	if [ ! -d "$pack_dir" ]; then
		bake.die "Path \"$pack_dir\" not a directory"
	fi

	local output=
	output=$(git status --porcelain)
	if [ -n "$output" ]; then
		bake.die "Please remove uncommitted changes"
	fi

	local latest_version_commit
	latest_version_commit=$(git --no-pager log --pretty=format:"%H" --grep '^pack-.*-.* v[0-9]\+\.[0-9]\+\.[0-9]\+' -- "$pack_dir" | head -1) || :
	bake.info "Newest commits for \"$pack_dir\":"
	git --no-pager log --oneline "$latest_version_commit"~..HEAD -- "$pack_dir"
	read -rp 'New Version? ' -ei 'v'
	local version=$REPLY
	if [[ -z "$version" || $version = 'v' ]]; then
		bake.die "Empty input"
	fi
	cd "$pack_dir"
	npm version --no-commit-hooks --no-git-tag-version "${version#v}"
	git add ./package.json
	(
		export GIT_COMMITTER_NAME='Otternaut'
		export GIT_COMMITTER_EMAIL='99463792+otternaut-bot@users.noreply.github.com'
		git commit -S0xFB6C155AFD89739C --author 'Otternaut <99463792+otternaut-bot@users.noreply.github.com>' -m "${pack_dir#./} $version"
		git add ../extension-list.json
		git commit -S0xFB6C155AFD89739C  --author 'Otternaut <99463792+otternaut-bot@users.noreply.github.com>' --amend --no-edit --no-verify
	)
	vsce publish
	ovsx publish --pat "$(<'../.ovsx-token')"
}
